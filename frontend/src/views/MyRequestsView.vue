<!--
  MyRequestsView (Requester): "New request" form next to the paginated list of the user's requests.

  States handled: loading (skeleton rows), empty list, load error (with retry),
  submit errors (field errors next to inputs, overlap / other errors above the form),
  and a success message after submitting.
-->
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { createVacationRequest, listMyVacationRequests } from "@/api/vacationRequests";
import AlertMessage from "@/components/AlertMessage.vue";
import Pagination from "@/components/Pagination.vue";
import RequestForm from "@/components/RequestForm.vue";
import StatusBadge from "@/components/StatusBadge.vue";
import type { CreateVacationRequestPayload, Paginated, VacationRequest } from "@/types";
import { getConflictingRequest, getErrorMessage, getErrorStatus, getFieldErrors } from "@/utils/api-errors";
import { countDays, formatDate } from "@/utils/dates";

// Requests per page (small, so the list stays next to the form without scrolling).
const PAGE_SIZE = 5;

// How long a success message stays on screen.
const SUCCESS_MESSAGE_MS = 5000;

// --- List state ---
const page = ref(1);
const result = ref<Paginated<VacationRequest> | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);

// --- Form state ---
const formRef = ref<InstanceType<typeof RequestForm> | null>(null);
const submitting = ref(false);
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string>>({});
const successMessage = ref<string | null>(null);

// Incremented on each load, so a slow older response cannot overwrite a newer one.
let latestLoad = 0;

async function loadRequests(): Promise<void> {
  const loadId = ++latestLoad;
  loading.value = true;
  loadError.value = null;
  try {
    const data = await listMyVacationRequests({ page: page.value, limit: PAGE_SIZE });
    if (loadId === latestLoad) result.value = data;
  } catch (error) {
    if (loadId === latestLoad) loadError.value = getErrorMessage(error, "Could not load your requests.");
  } finally {
    if (loadId === latestLoad) loading.value = false;
  }
}

function changePage(newPage: number): void {
  page.value = newPage;
  loadRequests();
}

/**
 * For an overlap (409), rebuilds the message with dates in the app's display format
 * ("22 Oct 2026" instead of the API's "2026-10-22"). Returns null for any other error.
 */
function overlapMessage(error: unknown): string | null {
  const conflict = getConflictingRequest(error);
  if (!conflict) return null;
  return (
    `These dates overlap your ${conflict.status.toLowerCase()} request ` +
    `from ${formatDate(conflict.startDate)} to ${formatDate(conflict.endDate)}.`
  );
}

async function submitRequest(payload: CreateVacationRequestPayload): Promise<void> {
  submitting.value = true;
  submitError.value = null;
  fieldErrors.value = {};
  successMessage.value = null;
  try {
    await createVacationRequest(payload);
    formRef.value?.reset();
    successMessage.value = "Request submitted. It is now pending approval.";
    // The new request is the most recent one: show the first page.
    page.value = 1;
    await loadRequests();
  } catch (error) {
    fieldErrors.value = getErrorStatus(error) === 400 ? getFieldErrors(error) : {};
    // Errors not tied to a field (overlap 409, network...) are shown above the form.
    if (Object.keys(fieldErrors.value).length === 0) {
      submitError.value = overlapMessage(error) ?? getErrorMessage(error, "Could not submit the request.");
    }
  } finally {
    submitting.value = false;
  }
}

onMounted(loadRequests);
</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    <!-- New request -->
    <section class="card p-5 sm:p-6" aria-labelledby="new-request-title">
      <h2 id="new-request-title" class="text-lg font-semibold text-stone-900">New request</h2>

      <!-- Success: disappears after a few seconds. Error: stays until closed or until the next submit. -->
      <AlertMessage
        v-if="successMessage"
        :key="successMessage"
        class="mt-4"
        tone="success"
        :auto-dismiss-ms="SUCCESS_MESSAGE_MS"
        @dismiss="successMessage = null"
      >
        {{ successMessage }}
      </AlertMessage>
      <AlertMessage v-if="submitError" :key="submitError" class="mt-4" tone="error" @dismiss="submitError = null">
        {{ submitError }}
      </AlertMessage>

      <RequestForm
        ref="formRef"
        class="mt-4"
        :submitting="submitting"
        :server-errors="fieldErrors"
        @submit="submitRequest"
      />
    </section>

    <!-- My requests -->
    <section class="card p-5 sm:p-6" aria-labelledby="my-requests-title" :aria-busy="loading">
      <div class="flex items-baseline justify-between gap-4">
        <h2 id="my-requests-title" class="text-lg font-semibold text-stone-900">My requests</h2>
        <p v-if="result && result.meta.total > 0" class="text-sm text-stone-500">{{ result.meta.total }} total</p>
      </div>

      <!-- Loading (first load): skeleton rows -->
      <ul v-if="loading && !result" class="mt-4 divide-y divide-sand-200" aria-label="Loading requests">
        <li v-for="n in 3" :key="n" class="flex items-center justify-between gap-4 py-3.5">
          <div class="w-full space-y-2">
            <div class="h-4 w-2/3 animate-pulse rounded-full bg-sand-200" />
            <div class="h-3 w-1/3 animate-pulse rounded-full bg-sand-100" />
          </div>
          <div class="h-6 w-20 animate-pulse rounded-full bg-sand-100" />
        </li>
      </ul>

      <!-- Error -->
      <div
        v-else-if="loadError"
        class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        role="alert"
      >
        <span>{{ loadError }}</span>
        <button type="button" class="btn-secondary" @click="loadRequests">Try again</button>
      </div>

      <!-- Empty -->
      <div v-else-if="result && result.data.length === 0" class="mt-4 rounded-2xl bg-sand-50 px-6 py-12 text-center">
        <p class="font-display text-3xl text-stone-800">No requests yet</p>
        <p class="mt-1 text-sm text-stone-500">Your submitted requests and their status will appear here.</p>
      </div>

      <!-- List -->
      <template v-else-if="result">
        <ul class="mt-2 divide-y divide-sand-200 transition-opacity" :class="{ 'opacity-50': loading }">
          <li v-for="request in result.data" :key="request.id" class="flex items-start justify-between gap-4 py-3.5">
            <div class="min-w-0">
              <p class="text-sm text-stone-900 sm:text-base">
                <span class="font-medium">{{ formatDate(request.startDate) }} → {{ formatDate(request.endDate) }}</span>
                <span class="whitespace-nowrap text-stone-500"> · {{ countDays(request.startDate, request.endDate) }} days</span>
              </p>
              <p class="mt-0.5 truncate text-sm" :class="request.reason ? 'text-stone-600' : 'text-stone-400'">
                {{ request.reason ?? "No reason" }}
              </p>
              <p v-if="request.status === 'Rejected' && request.comment" class="mt-1 text-sm text-rose-600">
                Comment: {{ request.comment }}
              </p>
            </div>
            <StatusBadge :status="request.status" />
          </li>
        </ul>

        <Pagination
          v-if="result.meta.totalPages > 1"
          class="mt-4 border-t border-sand-200 pt-4"
          :page="result.meta.page"
          :total-pages="result.meta.totalPages"
          :disabled="loading"
          @change="changePage"
        />
      </template>
    </section>
  </div>
</template>
