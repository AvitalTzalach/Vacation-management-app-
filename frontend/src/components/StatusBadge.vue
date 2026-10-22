<!--
  StatusBadge: colored pill showing a request status.
  Pending = peach, Approved = mint, Rejected = pink (as in the design screenshots).
-->
<script setup lang="ts">
import { computed } from "vue";
import type { VacationStatus } from "@/types";

const props = defineProps<{ status: VacationStatus }>();

const STATUS_CLASSES: Record<VacationStatus, string> = {
  Pending: "bg-amber-50 text-amber-800 ring-amber-200/70",
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  Rejected: "bg-rose-50 text-rose-700 ring-rose-200/70",
};

const classes = computed(() => STATUS_CLASSES[props.status]);
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset"
    :class="classes"
  >
    {{ status }}
  </span>
</template>
