<!--
  Pagination: "Page X of Y" with Previous / Next buttons.
  Stateless: the parent owns the current page and reloads data on `change`.
-->
<script setup lang="ts">
const props = defineProps<{
  page: number;
  totalPages: number;
  // Disables both buttons (e.g. while a page is loading).
  disabled?: boolean;
}>();

const emit = defineEmits<{ change: [page: number] }>();

// Emits the new page if it is within bounds.
function goTo(page: number): void {
  if (page >= 1 && page <= props.totalPages && page !== props.page) {
    emit("change", page);
  }
}
</script>

<template>
  <nav class="flex items-center justify-between gap-4" aria-label="Pagination">
    <p class="text-sm text-stone-500">
      Page <span class="font-medium text-stone-700">{{ page }}</span> of
      <span class="font-medium text-stone-700">{{ totalPages }}</span>
    </p>
    <div class="flex gap-2">
      <button type="button" class="btn-secondary" :disabled="disabled || page <= 1" @click="goTo(page - 1)">
        Previous
      </button>
      <button type="button" class="btn-secondary" :disabled="disabled || page >= totalPages" @click="goTo(page + 1)">
        Next
      </button>
    </div>
  </nav>
</template>
