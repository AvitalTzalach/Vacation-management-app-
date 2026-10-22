<!--
  ConfirmModal: reusable confirmation dialog.

  - Optional comment field (`withComment`); when `commentRequired` is set, the confirm button
    stays disabled until the comment has non-blank text (used for "reject": rule 5).
  - `loading` disables everything while the parent calls the API; `error` shows the API's message.
  - Accessible: role="dialog", focus moves into the dialog when it opens and back to the
    previously focused element when it closes, Escape and a click outside cancel (not while loading).
-->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import Spinner from "@/components/Spinner.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    // "danger" = red confirm button (destructive action).
    tone?: "primary" | "danger";
    withComment?: boolean;
    commentRequired?: boolean;
    commentLabel?: string;
    commentPlaceholder?: string;
    commentMaxLength?: number;
    loading?: boolean;
    error?: string | null;
  }>(),
  {
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    tone: "primary",
    withComment: false,
    commentRequired: false,
    commentLabel: "Comment",
    commentPlaceholder: "",
    commentMaxLength: 1000,
    loading: false,
    error: null,
  }
);

const emit = defineEmits<{
  confirm: [comment: string];
  cancel: [];
}>();

const comment = ref("");
const dialogRef = ref<HTMLElement | null>(null);
const commentRef = ref<HTMLTextAreaElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

const canConfirm = computed(() => !props.loading && (!props.commentRequired || comment.value.trim().length > 0));

// On open: clear the comment and move focus inside. On close: give focus back.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      comment.value = "";
      await nextTick();
      (commentRef.value ?? dialogRef.value)?.focus();
    } else {
      previouslyFocused?.focus();
    }
  }
);

function cancel(): void {
  if (!props.loading) emit("cancel");
}

function confirm(): void {
  if (canConfirm.value) emit("confirm", comment.value.trim());
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 backdrop-blur-[2px] sm:items-center"
        @click.self="cancel"
        @keydown.esc="cancel"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          tabindex="-1"
          class="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl focus:outline-none sm:p-7"
        >
          <h2 id="confirm-modal-title" class="text-xl font-semibold text-stone-900">{{ title }}</h2>
          <p v-if="message" class="mt-2 text-stone-600">{{ message }}</p>

          <div v-if="withComment" class="mt-5">
            <label for="confirm-modal-comment" class="field-label">
              {{ commentLabel }}<span v-if="commentRequired"> *</span>
            </label>
            <textarea
              id="confirm-modal-comment"
              ref="commentRef"
              v-model="comment"
              rows="3"
              class="field-input resize-none"
              :placeholder="commentPlaceholder"
              :maxlength="commentMaxLength"
              :disabled="loading"
            />
          </div>

          <div
            v-if="error"
            class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            role="alert"
          >
            {{ error }}
          </div>

          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" class="btn-secondary" :disabled="loading" @click="cancel">{{ cancelLabel }}</button>
            <button
              type="button"
              :class="
                tone === 'danger'
                  ? 'btn-primary bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-200'
                  : 'btn-primary'
              "
              :disabled="!canConfirm"
              @click="confirm"
            >
              <Spinner v-if="loading" class="size-4" />
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
