<!--
  RequestForm: start date, end date and optional reason for a vacation request.

  - Checks the same rules as the API before sending (required dates, start not in the past,
    end strictly after start), for instant feedback. The API remains the source of truth.
  - Shows field errors returned by the API (`serverErrors`) next to the matching input.
  - Emits `submit` with the payload; the parent calls the API and then `reset()` on success.
-->
<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import Spinner from "@/components/Spinner.vue";
import type { CreateVacationRequestPayload } from "@/types";
import { addDays, todayIso } from "@/utils/dates";

const REASON_MAX_LENGTH = 500;

const props = withDefaults(
  defineProps<{
    submitting?: boolean;
    // Field errors from the API, e.g. { endDate: "End date must be after start date." }.
    serverErrors?: Record<string, string>;
    submitLabel?: string;
  }>(),
  { submitting: false, serverErrors: () => ({}), submitLabel: "Submit request" }
);

const emit = defineEmits<{ submit: [payload: CreateVacationRequestPayload] }>();

const form = reactive({ startDate: "", endDate: "", reason: "" });
const clientErrors = ref<Record<string, string>>({});

// Browser date pickers cannot select a past start, or an end on/before the start.
const today = todayIso();
const minEndDate = computed(() => addDays(form.startDate || today, 1));

// Client errors win; otherwise show what the API said.
const errors = computed(() => ({ ...props.serverErrors, ...clientErrors.value }));

// Same rules as the backend (rules 1 and 4), checked before sending.
function validate(): boolean {
  const found: Record<string, string> = {};
  if (!form.startDate) found.startDate = "Start date is required.";
  else if (form.startDate < today) found.startDate = "Start date cannot be in the past.";

  if (!form.endDate) found.endDate = "End date is required.";
  else if (form.startDate && form.endDate <= form.startDate) found.endDate = "End date must be after start date.";

  clientErrors.value = found;
  return Object.keys(found).length === 0;
}

function onSubmit(): void {
  if (props.submitting || !validate()) return;
  emit("submit", {
    startDate: form.startDate,
    endDate: form.endDate,
    reason: form.reason.trim() || null,
  });
}

// Editing a field clears its error, so stale messages do not stay on screen.
watch(() => form.startDate, () => delete clientErrors.value.startDate);
watch(() => form.endDate, () => delete clientErrors.value.endDate);

// Clears the form (called by the parent after a successful submit).
function reset(): void {
  form.startDate = "";
  form.endDate = "";
  form.reason = "";
  clientErrors.value = {};
}

defineExpose({ reset });
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="onSubmit">
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label for="startDate" class="field-label">Start date *</label>
        <input
          id="startDate"
          v-model="form.startDate"
          type="date"
          class="field-input"
          :class="{ 'field-input-error': errors.startDate }"
          :min="today"
          :disabled="submitting"
          :aria-invalid="Boolean(errors.startDate)"
          aria-describedby="startDate-error"
        />
        <p v-if="errors.startDate" id="startDate-error" class="field-error">{{ errors.startDate }}</p>
      </div>

      <div>
        <label for="endDate" class="field-label">End date *</label>
        <input
          id="endDate"
          v-model="form.endDate"
          type="date"
          class="field-input"
          :class="{ 'field-input-error': errors.endDate }"
          :min="minEndDate"
          :disabled="submitting"
          :aria-invalid="Boolean(errors.endDate)"
          aria-describedby="endDate-error"
        />
        <p v-if="errors.endDate" id="endDate-error" class="field-error">{{ errors.endDate }}</p>
      </div>
    </div>

    <div>
      <label for="reason" class="field-label">Reason</label>
      <textarea
        id="reason"
        v-model="form.reason"
        rows="3"
        class="field-input resize-none"
        :class="{ 'field-input-error': errors.reason }"
        placeholder="Optional"
        :maxlength="REASON_MAX_LENGTH"
        :disabled="submitting"
      />
      <p v-if="errors.reason" class="field-error">{{ errors.reason }}</p>
    </div>

    <button type="submit" class="btn-primary w-full" :disabled="submitting">
      <Spinner v-if="submitting" class="size-4" />
      {{ submitting ? "Submitting…" : submitLabel }}
    </button>
  </form>
</template>
