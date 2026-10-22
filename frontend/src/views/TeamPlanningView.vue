<!--
  TeamPlanningView (Requester and Validator): who is away, and when — one month at a time.

  - Grid: one row per employee with an approved absence in the month, one column per day.
    Approved days are turquoise, weekends are shaded, today's column is highlighted.
  - The month is kept in the URL (?month=2026-10), so Previous / Next work with refresh and back.
  - Only Approved requests are shown (the API never returns reasons or comments).
  - On small screens the grid scrolls horizontally inside its card, with the names column pinned.
-->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getTeamPlanning } from "@/api/teamPlanning";
import type { TeamPlanningEntry } from "@/types";
import { getErrorMessage } from "@/utils/api-errors";
import {
  addMonths,
  currentMonth,
  daysInMonth,
  formatDate,
  formatMonth,
  isValidMonth,
  isWeekend,
  monthBounds,
  todayIso,
} from "@/utils/dates";

const route = useRoute();
const router = useRouter();

// Displayed month: from the URL, or the current month.
const month = computed(() => (isValidMonth(route.query.month) ? route.query.month : currentMonth()));
const isCurrentMonth = computed(() => month.value === currentMonth());

function goToMonth(target: string): void {
  router.replace({ query: target === currentMonth() ? {} : { month: target } });
}

// One column per day of the month, with display hints.
const today = todayIso();
const days = computed(() =>
  Array.from({ length: daysInMonth(month.value) }, (_, index) => {
    const date = `${month.value}-${String(index + 1).padStart(2, "0")}`;
    return { number: index + 1, date, weekend: isWeekend(date), today: date === today };
  })
);

// --- Data ---
const entries = ref<TeamPlanningEntry[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);
let latestLoad = 0;

async function load(): Promise<void> {
  const loadId = ++latestLoad;
  const { from, to } = monthBounds(month.value);
  loading.value = true;
  loadError.value = null;
  try {
    const result = await getTeamPlanning(from, to);
    if (loadId === latestLoad) entries.value = result.data;
  } catch (error) {
    if (loadId === latestLoad) loadError.value = getErrorMessage(error, "Could not load the team planning.");
  } finally {
    if (loadId === latestLoad) loading.value = false;
  }
}

// Loads on open and whenever the month changes.
watch(month, load, { immediate: true });

/**
 * On narrow screens the grid scrolls horizontally: once the current month is displayed,
 * scroll so that today's column is visible instead of always starting on day 1.
 */
const gridRef = ref<HTMLElement | null>(null);
watch(gridRef, async (grid) => {
  if (!grid) return;
  await nextTick();
  const todayHeader = grid.querySelector<HTMLElement>("[data-today]");
  const namesWidth = grid.querySelector<HTMLElement>("thead th")?.offsetWidth ?? 0;
  if (todayHeader && grid.scrollWidth > grid.clientWidth) {
    grid.scrollLeft = Math.max(0, todayHeader.offsetLeft - namesWidth - 3 * todayHeader.offsetWidth);
  }
});

/**
 * Groups the absences by employee (the API already sorts by name) and, for each day of the
 * month, keeps the absence covering it — used for the colored cell and its tooltip.
 */
const rows = computed(() => {
  const byUser = new Map<number, { userId: number; name: string; absences: TeamPlanningEntry[] }>();
  for (const entry of entries.value) {
    const row = byUser.get(entry.userId) ?? { userId: entry.userId, name: entry.userName, absences: [] };
    row.absences.push(entry);
    byUser.set(entry.userId, row);
  }
  return [...byUser.values()].map((row) => ({
    ...row,
    // "YYYY-MM-DD" strings compare correctly, so a date is inside a range with <= / >=.
    cells: days.value.map((day) => row.absences.find((a) => a.startDate <= day.date && a.endDate >= day.date) ?? null),
  }));
});

// Tooltip of an approved cell.
function absenceLabel(name: string, absence: TeamPlanningEntry): string {
  return `${name} · ${formatDate(absence.startDate)} → ${formatDate(absence.endDate)}`;
}
</script>

<template>
  <section class="card p-6 sm:p-8" aria-labelledby="planning-title" :aria-busy="loading">
    <!-- Month header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 id="planning-title" class="text-xl font-semibold text-stone-900">{{ formatMonth(month) }}</h2>
      <div class="flex gap-2">
        <button v-if="!isCurrentMonth" type="button" class="btn-secondary" @click="goToMonth(currentMonth())">
          Today
        </button>
        <button type="button" class="btn-secondary" :disabled="loading" @click="goToMonth(addMonths(month, -1))">
          Previous
        </button>
        <button type="button" class="btn-secondary" :disabled="loading" @click="goToMonth(addMonths(month, 1))">
          Next
        </button>
      </div>
    </div>

    <!-- Error -->
    <div
      v-if="loadError"
      class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
      role="alert"
    >
      <span>{{ loadError }}</span>
      <button type="button" class="btn-secondary" @click="load">Try again</button>
    </div>

    <!-- First load: skeleton -->
    <div v-else-if="loading && rows.length === 0" class="mt-6 space-y-3" aria-label="Loading">
      <div v-for="n in 3" :key="n" class="h-8 animate-pulse rounded-lg bg-sand-100" />
    </div>

    <!-- Empty month -->
    <div v-else-if="rows.length === 0" class="mt-6 rounded-2xl bg-sand-50 px-6 py-12 text-center">
      <p class="font-display text-3xl text-stone-800">Everyone is around</p>
      <p class="mt-1 text-sm text-stone-500">No approved vacation in {{ formatMonth(month) }}.</p>
    </div>

    <!-- Grid. `relative` makes this box the containing block of the absolutely positioned
         screen-reader texts in the cells; without it they escape the horizontal scroll
         and widen the whole page on mobile. -->
    <div
      v-else
      ref="gridRef"
      class="relative mt-6 overflow-x-auto"
      :class="{ 'opacity-50 transition-opacity': loading }"
    >
      <table class="w-full border-separate border-spacing-[3px]">
        <thead>
          <tr>
            <th scope="col" class="sticky left-0 z-10 min-w-32 bg-white pr-3 text-left">
              <span class="sr-only">Employee</span>
            </th>
            <th
              v-for="day in days"
              :key="day.date"
              scope="col"
              class="min-w-6 text-center text-xs font-normal"
              :data-today="day.today || undefined"
              :class="day.today ? 'font-semibold text-brand-700' : day.weekend ? 'text-stone-400' : 'text-stone-500'"
            >
              {{ day.number }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.userId">
            <th scope="row" class="sticky left-0 z-10 bg-white pr-3 text-left font-normal whitespace-nowrap text-stone-800">
              {{ row.name }}
            </th>
            <td v-for="(absence, index) in row.cells" :key="days[index].date" class="p-0">
              <div
                class="h-8 rounded-md"
                :class="[
                  absence ? 'bg-brand-500' : days[index].weekend ? 'bg-sand-300/60' : 'bg-sand-100',
                  days[index].today ? 'ring-2 ring-brand-300 ring-offset-1' : '',
                ]"
                :title="absence ? absenceLabel(row.name, absence) : undefined"
              >
                <span v-if="absence" class="sr-only">{{ absenceLabel(row.name, absence) }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Legend -->
    <div class="mt-5 flex flex-wrap items-center gap-5 text-sm text-stone-500">
      <span class="flex items-center gap-2"><span class="size-3 rounded-sm bg-brand-500" /> Approved</span>
      <span class="flex items-center gap-2"><span class="size-3 rounded-sm bg-sand-300/60" /> Weekend</span>
      <span class="flex items-center gap-2"><span class="size-3 rounded-sm ring-2 ring-brand-300" /> Today</span>
    </div>
  </section>
</template>
