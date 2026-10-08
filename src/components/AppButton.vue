<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', size: 'md', block: false, disabled: false, type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex select-none items-center justify-center gap-1.5 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    :class="[
      {
        primary: 'bg-accent text-white shadow-sm',
        secondary: 'border border-line bg-paper text-ink',
        ghost: 'text-accent',
        danger: 'bg-danger text-white',
        success: 'bg-success text-white',
      }[variant!],
      {
        sm: 'min-h-9 px-3 text-[14px]',
        md: 'min-h-11 px-4 text-[16px]',
        lg: 'min-h-[52px] px-6 text-[17px]',
      }[size!],
      block ? 'w-full' : '',
    ]"
  >
    <slot />
  </button>
</template>
