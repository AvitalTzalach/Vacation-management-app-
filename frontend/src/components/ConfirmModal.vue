<!--
  ConfirmModal: reusable confirmation dialog.

  - Optional comment field (`withComment`). When `commentRequired` is set and the user confirms
    with an empty or blank comment, the field turns red, `commentRequiredMessage` explains why,
    and focus goes back to the field (used for "reject": rule 5). The confirm button is never
    disabled for this reason: a disabled button without an explanation is confusing.
  - `loading` disables everything while the parent calls the API; `error` shows the API's message.
  - Accessible: role="dialog", focus moves into the dialog when it opens and back to the
    previously focused element when it closes, Escape and a click outside cancel (not while loading).
-->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import AlertMessage from "@/components/AlertMessage.vue";
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
    // Message shown under the comment field when a required comment is missing.
    commentRequiredMessage?: string;
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
    commentRequiredMessage: "This field is required.",
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

// Error shown under the comment field after a confirm attempt without a required comment.
const commentError = ref<string | null>(null);

const isCommentMissing = computed(() => props.commentRequired && comment.value.trim().length === 0);

// As soon as the user types real text, the error disappears.
watch(comment, () => {
  if (!isCommentMissing.value) commentError.value = null;
});

// On open: clear the comment and its error, and move focus inside. On close: give focus back.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      comment.value = "";
      commentError.value = null;
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

// Validates the required comment, then emits `confirm`.
function confirm(): void {
  if (props.loading) return;
  if (isCommentMissing.value) {
    commentError.value = props.commentRequiredMessage;
    commentRef.value?.focus();
    return;
  }
  emit("confirm", comment.value.trim());
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
              :class="{ 'field-input-error': commentError }"
              :placeholder="commentPlaceholder"
              :maxlength="commentMaxLength"
              :disabled="loading"
              :aria-invalid="Boolean(commentError)"
              aria-describedby="confirm-modal-comment-error"
            />
            <p v-if="commentError" id="confirm-modal-comment-error" class="field-error" role="alert">
              {{ commentError }}
            </p>
          </div>

          <!-- No × here: the error disappears with the dialog or on the next attempt. -->
          <AlertMessage v-if="error" class="mt-4" tone="error" :dismissible="false">
            {{ error }}
          </AlertMessage>

          <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" class="btn-secondary" :disabled="loading" @click="cancel">{{ cancelLabel }}</button>
            <button
              type="button"
              :class="
                tone === 'danger'
                  ? 'btn-primary bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-200'
                  : 'btn-primary'
              "
              :disabled="loading"
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
