<!--
  ValidatorDashboardView (Validator): all vacation requests, filterable by status and employee,
  paginated, with Approve / Reject actions on Pending requests.

  - The URL query (?status=&userId=&page=) is the single source of truth for filters and page:
    the controls update the URL, and a watcher on the URL loads the data. Refreshing the page or
    sharing the link keeps the same view.
  - Approve asks for confirmation; Reject requires a comment (rule 5) in the same ConfirmModal.
  - If another validator already handled the request (409) or it no longer exists (404), the
    dialog closes, the message is shown, and the list is reloaded.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, type LocationQuery } from "vue-router";
import { listUsers } from "@/api/users";
import {
  approveVacationRequest,
  listAllVacationRequests,
  rejectVacationRequest,
} from "@/api/vacationRequests";
import ConfirmModal from "@/components/ConfirmModal.vue";
import DataTable, { type DataTableColumn } from "@/components/DataTable.vue";
import Pagination from "@/components/Pagination.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import type { Paginated, UserSummary, VacationRequestWithUser, VacationStatus } from "@/types";
import { getErrorMessage, getErrorStatus, getFieldErrors } from "@/utils/api-errors";
import { countDays, formatDate } from "@/utils/dates";

const PAGE_SIZE = 10;
const STATUSES: VacationStatus[] = ["Pending", "Approved", "Rejected"];
const COMMENT_MAX_LENGTH = 1000;

const columns: DataTableColumn[] = [
  { key: "employee", label: "Employee" },
  { key: "dates", label: "Dates" },
  { key: "reason", label: "Reason" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", class: "text-right", hideLabelOnMobile: true },
];

const route = useRoute();
const router = useRouter();

// --- Filters and page, read from the URL ---
interface DashboardQuery {
  status?: VacationStatus;
  userId?: number;
  page: number;
}

// Reads and sanitizes the URL query (unknown values are ignored).
function parseQuery(query: LocationQuery): DashboardQuery {
  const status = STATUSES.find((s) => s === query.status);
  const userId = Number(query.userId);
  const page = Number(query.page);
  return {
    status,
    userId: Number.isInteger(userId) && userId > 0 ? userId : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

const current = computed(() => parseQuery(route.query));
const hasFilters = computed(() => Boolean(current.value.status || current.value.userId));

// Writes filters / page to the URL (replace: filter changes do not pile up in the history).
function updateQuery(next: DashboardQuery): void {
  router.replace({
    query: {
      ...(next.status ? { status: next.status } : {}),
      ...(next.userId ? { userId: String(next.userId) } : {}),
      ...(next.page > 1 ? { page: String(next.page) } : {}),
    },
  });
}

// Changing a filter always goes back to page 1.
function onStatusChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as VacationStatus | "";
  updateQuery({ ...current.value, status: value || undefined, page: 1 });
}

function onUserChange(event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value);
  updateQuery({ ...current.value, userId: value || undefined, page: 1 });
}

function clearFilters(): void {
  updateQuery({ page: 1 });
}

function changePage(page: number): void {
  updateQuery({ ...current.value, page });
}

// --- Employees (filter options) ---
const users = ref<UserSummary[]>([]);
const usersError = ref(false);

async function loadUsers(): Promise<void> {
  try {
    users.value = await listUsers();
  } catch {
    usersError.value = true;
  }
}

// --- Requests ---
const result = ref<Paginated<VacationRequestWithUser> | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);
let latestLoad = 0;

async function loadRequests(): Promise<void> {
  const loadId = ++latestLoad;
  const { status, userId, page } = current.value;
  loading.value = true;
  loadError.value = null;
  try {
    const data = await listAllVacationRequests({ status, userId, page, limit: PAGE_SIZE });
    if (loadId !== latestLoad) return;
    // The page no longer exists (e.g. its last Pending request was just approved): go to the last page.
    if (data.data.length === 0 && page > 1 && data.meta.totalPages > 0) {
      changePage(data.meta.totalPages);
      return;
    }
    result.value = data;
  } catch (error) {
    if (loadId === latestLoad) loadError.value = getErrorMessage(error, "Could not load the requests.");
  } finally {
    if (loadId === latestLoad) loading.value = false;
  }
}

// Any change of the URL query (filters, page, back / forward) reloads the list.
watch(() => route.query, loadRequests);

// --- Notices (success / error after an action) ---
const notice = ref<{ tone: "success" | "error"; text: string } | null>(null);
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

function showNotice(tone: "success" | "error", text: string): void {
  notice.value = { tone, text };
  clearTimeout(noticeTimer);
  // Success messages disappear by themselves; errors stay until the next action.
  if (tone === "success") noticeTimer = setTimeout(() => (notice.value = null), 5000);
}

// --- Approve / reject ---
const action = ref<{ type: "approve" | "reject"; request: VacationRequestWithUser } | null>(null);
const actionLoading = ref(false);
const actionError = ref<string | null>(null);

function openAction(type: "approve" | "reject", request: VacationRequestWithUser): void {
  action.value = { type, request };
  actionError.value = null;
}

function closeAction(): void {
  action.value = null;
}

const modalTitle = computed(() =>
  action.value?.type === "reject" ? "Reject this request?" : "Approve this request?"
);

const modalMessage = computed(() => {
  if (!action.value) return "";
  const { request } = action.value;
  return `${request.user.name} · ${formatDate(request.startDate)} → ${formatDate(request.endDate)} (${countDays(request.startDate, request.endDate)} days)`;
});

async function confirmAction(comment: string): Promise<void> {
  if (!action.value) return;
  const { type, request } = action.value;
  actionLoading.value = true;
  actionError.value = null;
  try {
    if (type === "approve") await approveVacationRequest(request.id);
    else await rejectVacationRequest(request.id, comment);
    showNotice("success", `${request.user.name}'s request was ${type === "approve" ? "approved" : "rejected"}.`);
    action.value = null;
    await loadRequests();
  } catch (error) {
    const status = getErrorStatus(error);
    if (status === 409 || status === 404) {
      // Someone else already handled it, or it is gone: show why and refresh the list.
      action.value = null;
      showNotice("error", getErrorMessage(error));
      await loadRequests();
    } else {
      actionError.value = getFieldErrors(error).comment ?? getErrorMessage(error, "The action failed.");
    }
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => {
  loadUsers();
  loadRequests();
});

onBeforeUnmount(() => clearTimeout(noticeTimer));
</script>

<template>
  <section class="card p-5 sm:p-6" aria-labelledby="dashboard-title">
    <h2 id="dashboard-title" class="sr-only">All vacation requests</h2>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <label class="sr-only" for="status-filter">Status</label>
      <select
        id="status-filter"
        class="field-input w-auto py-2 pr-10 text-sm"
        :value="current.status ?? ''"
        @change="onStatusChange"
      >
        <option value="">All statuses</option>
        <option v-for="status in STATUSES" :key="status" :value="status">{{ status }}</option>
      </select>

      <label class="sr-only" for="user-filter">Employee</label>
      <select
        id="user-filter"
        class="field-input w-auto py-2 pr-10 text-sm"
        :value="current.userId ?? ''"
        :disabled="usersError"
        @change="onUserChange"
      >
        <option value="">{{ usersError ? "Employees unavailable" : "All employees" }}</option>
        <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
      </select>

      <button v-if="hasFilters" type="button" class="text-sm font-medium text-brand-700 hover:underline" @click="clearFilters">
        Clear filters
      </button>

      <p v-if="result" class="ml-auto text-sm text-stone-500">
        {{ result.meta.total }} {{ result.meta.total === 1 ? "request" : "requests" }}
      </p>
    </div>

    <!-- Notice after an action -->
    <div
      v-if="notice"
      class="mt-5 rounded-2xl border px-4 py-3 text-sm"
      :class="
        notice.tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-700'
      "
      :role="notice.tone === 'success' ? 'status' : 'alert'"
    >
      {{ notice.text }}
    </div>

    <!-- Load error -->
    <div
      v-if="loadError"
      class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
      role="alert"
    >
      <span>{{ loadError }}</span>
      <button type="button" class="btn-secondary" @click="loadRequests">Try again</button>
    </div>

    <!-- Requests -->
    <DataTable
      v-else
      class="mt-4"
      :columns="columns"
      :rows="result?.data ?? []"
      :row-key="(row) => row.id"
      :loading="loading"
      :empty-title="hasFilters ? 'No matching requests' : 'No requests yet'"
      :empty-text="hasFilters ? 'Try another status or employee.' : 'Requests submitted by the team will appear here.'"
    >
      <template #cell-employee="{ row }">
        <span class="text-sm font-medium text-stone-900">{{ row.user.name }}</span>
      </template>

      <template #cell-dates="{ row }">
        <p class="whitespace-nowrap text-sm text-stone-800">{{ formatDate(row.startDate) }} → {{ formatDate(row.endDate) }}</p>
        <p class="text-sm text-stone-500">{{ countDays(row.startDate, row.endDate) }} days</p>
      </template>

      <template #cell-reason="{ row }">
        <p class="max-w-xs text-sm" :class="row.reason ? 'text-stone-700' : 'text-stone-400'">
          {{ row.reason ?? "No reason" }}
        </p>
        <p v-if="row.comment" class="mt-1 max-w-xs text-sm text-rose-600">Comment: {{ row.comment }}</p>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :status="row.status" />
      </template>

      <template #cell-actions="{ row }">
        <div v-if="row.status === 'Pending'" class="flex justify-end gap-2 max-md:justify-start">
          <button type="button" class="btn-primary px-3.5 py-1.5" @click="openAction('approve', row)">
            Approve
          </button>
          <button type="button" class="btn-secondary" @click="openAction('reject', row)">Reject</button>
        </div>
        <span v-else class="text-sm text-stone-400 max-md:hidden">—</span>
      </template>
    </DataTable>

    <Pagination
      v-if="result && result.meta.totalPages > 1"
      class="mt-4 border-t border-sand-200 pt-4"
      :page="result.meta.page"
      :total-pages="result.meta.totalPages"
      :disabled="loading"
      @change="changePage"
    />
  </section>

  <ConfirmModal
    :open="action !== null"
    :title="modalTitle"
    :message="modalMessage"
    :confirm-label="action?.type === 'reject' ? 'Reject request' : 'Approve request'"
    :tone="action?.type === 'reject' ? 'danger' : 'primary'"
    :with-comment="action?.type === 'reject'"
    :comment-required="action?.type === 'reject'"
    comment-label="Reason for rejection"
    comment-placeholder="Explain why, so the employee can pick other dates."
    :comment-max-length="COMMENT_MAX_LENGTH"
    :loading="actionLoading"
    :error="actionError"
    @confirm="confirmAction"
    @cancel="closeAction"
  />
</template>
