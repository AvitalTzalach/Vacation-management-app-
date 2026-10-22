<!--
  DataTable: generic, reusable table (knows nothing about vacations).

  - `columns` lists the columns; each cell can be customized with a scoped slot named
    `cell-<key>` (receives `{ row }`). Without a slot, `row[key]` is printed.
  - Desktop (md and up): a real <table>. Mobile: each row becomes a stacked card that reuses the
    same slots, with the column label above each value — no horizontal scrolling.
  - Built-in states: loading skeleton (first load), dimmed rows while reloading, empty message.
-->
<script setup lang="ts" generic="T">
export interface DataTableColumn {
  key: string;
  label: string;
  // Extra classes for the header and cells of this column (e.g. "text-right").
  class?: string;
  // Hides the label in the mobile card (for action buttons).
  hideLabelOnMobile?: boolean;
}

const props = withDefaults(
  defineProps<{
    columns: DataTableColumn[];
    rows: T[];
    // Returns a unique key for each row (used by v-for).
    rowKey: (row: T) => string | number;
    loading?: boolean;
    emptyTitle?: string;
    emptyText?: string;
    // Number of placeholder rows during the first load.
    skeletonRows?: number;
  }>(),
  { loading: false, emptyTitle: "Nothing here", emptyText: "", skeletonRows: 5 }
);

// Default cell content when no slot is given.
function cellValue(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

// First load = loading with nothing to show yet → skeleton instead of an empty message.
const isFirstLoad = () => props.loading && props.rows.length === 0;
</script>

<template>
  <div :aria-busy="loading">
    <!-- Skeleton (first load) -->
    <div v-if="isFirstLoad()" class="divide-y divide-sand-200" aria-label="Loading">
      <div v-for="n in skeletonRows" :key="n" class="flex items-center gap-6 py-4">
        <div class="h-4 w-1/4 animate-pulse rounded-full bg-sand-200" />
        <div class="h-4 w-1/3 animate-pulse rounded-full bg-sand-100" />
        <div class="ml-auto h-6 w-20 animate-pulse rounded-full bg-sand-100" />
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="rows.length === 0" class="rounded-2xl bg-sand-50 px-6 py-12 text-center">
      <slot name="empty">
        <p class="font-display text-3xl text-stone-800">{{ emptyTitle }}</p>
        <p v-if="emptyText" class="mt-1 text-sm text-stone-500">{{ emptyText }}</p>
      </slot>
    </div>

    <template v-else>
      <!-- Desktop: table -->
      <table class="hidden w-full text-left md:table" :class="{ 'opacity-50 transition-opacity': loading }">
        <thead>
          <tr class="border-b border-sand-200">
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              class="px-3 pb-2 text-[0.7rem] font-medium tracking-[0.12em] text-stone-500 uppercase first:pl-0 last:pr-0"
              :class="column.class"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-sand-200">
          <tr v-for="row in rows" :key="rowKey(row)" class="align-top">
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-3 py-3 first:pl-0 last:pr-0"
              :class="column.class"
            >
              <slot :name="`cell-${column.key}`" :row="row">{{ cellValue(row, column.key) }}</slot>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile: one card per row -->
      <ul class="divide-y divide-sand-200 md:hidden" :class="{ 'opacity-50 transition-opacity': loading }">
        <li v-for="row in rows" :key="rowKey(row)" class="space-y-2 py-3">
          <div v-for="column in columns" :key="column.key">
            <p v-if="!column.hideLabelOnMobile" class="text-[0.7rem] font-medium tracking-[0.12em] text-stone-500 uppercase">
              {{ column.label }}
            </p>
            <slot :name="`cell-${column.key}`" :row="row">{{ cellValue(row, column.key) }}</slot>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
