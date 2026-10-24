<!--
  AlertMessage: colored message box used for every notification in the app.

  - tone: success (green), error (red) or warning (amber).
  - dismissible: shows a small × button that emits `dismiss`.
  - autoDismissMs: if set, emits `dismiss` by itself after that delay. Used for success messages
    only — errors stay until the user closes them, because they must be read and acted upon.
    The timer pauses while the pointer is over the message or while it has keyboard focus,
    so a message never disappears in the middle of being read (WCAG 2.2.1 "Timing adjustable").

  The parent owns the visibility (v-if) and should set `:key` to the message text, so a new
  message restarts the timer.
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

const props = withDefaults(
  defineProps<{
    tone?: "success" | "error" | "warning";
    dismissible?: boolean;
    autoDismissMs?: number;
  }>(),
  { tone: "success", dismissible: true, autoDismissMs: 0 }
);

const emit = defineEmits<{ dismiss: [] }>();

const TONE_CLASSES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

let timer: ReturnType<typeof setTimeout> | undefined;

// (Re)starts the auto-dismiss countdown, if this message has one.
function startTimer(): void {
  stopTimer();
  if (props.autoDismissMs > 0) {
    timer = setTimeout(() => emit("dismiss"), props.autoDismissMs);
  }
}

function stopTimer(): void {
  clearTimeout(timer);
  timer = undefined;
}

onMounted(startTimer);
onBeforeUnmount(stopTimer);
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm"
    :class="TONE_CLASSES[tone]"
    :role="tone === 'error' ? 'alert' : 'status'"
    @mouseenter="stopTimer"
    @mouseleave="startTimer"
    @focusin="stopTimer"
    @focusout="startTimer"
  >
    <div class="min-w-0 flex-1">
      <slot />
    </div>
    <button
      v-if="dismissible"
      type="button"
      class="-my-1 -mr-2 shrink-0 rounded-full p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
      aria-label="Dismiss message"
      title="Dismiss"
      @click="emit('dismiss')"
    >
      <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  </div>
</template>
