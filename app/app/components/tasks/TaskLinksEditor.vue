<script lang="ts">
import { defineComponent, h, resolveComponent, type PropType } from "vue"

interface TaskLink {
  title: string
  url: string
}

export default defineComponent({
  name: "TaskLinksEditor",
  props: {
    modelValue: {
      type: Array as PropType<TaskLink[]>,
      required: true,
    },
    addLabel: {
      type: String,
      default: "追加",
    },
    helpText: {
      type: String,
      default: "最大20件。タイトルとURLを両方入力してください。",
    },
  },
  emits: {
    "update:modelValue": (_value: TaskLink[]) => true,
  },
  setup(props, { emit }) {
    const addLink = () => {
      if (props.modelValue.length >= 20) return
      emit("update:modelValue", [...props.modelValue, { title: "", url: "" }])
    }

    const updateLink = (index: number, field: keyof TaskLink, value: string | null) => {
      const links = props.modelValue.map((link, currentIndex) => (
        currentIndex === index
          ? { ...link, [field]: value ?? "" }
          : link
      ))
      emit("update:modelValue", links)
    }

    const removeLink = (index: number) => {
      emit("update:modelValue", props.modelValue.filter((_, currentIndex) => currentIndex !== index))
    }

    return () => {
      const VBtn = resolveComponent("v-btn")
      const VTextField = resolveComponent("v-text-field")

      return h("div", { class: "mb-4" }, [
        h("div", { class: "d-flex align-center justify-space-between mb-2" }, [
          h("div", { class: "text-subtitle-2 font-weight-medium" }, "関連リンク"),
          h(VBtn, {
            size: "small",
            variant: "tonal",
            prependIcon: "mdi-plus",
            disabled: props.modelValue.length >= 20,
            onClick: addLink,
          }, () => props.addLabel),
        ]),
        ...props.modelValue.map((taskLink, index) => h("div", {
          key: index,
          class: "d-flex align-start ga-2 mb-2",
        }, [
          h("div", { class: "flex-grow-1" }, [
            h(VTextField, {
              modelValue: taskLink.title,
              label: "表示タイトル",
              placeholder: "例：資料・参考ページ",
              variant: "outlined",
              density: "comfortable",
              hideDetails: true,
              class: "mb-2",
              "onUpdate:modelValue": (value: string | null) => updateLink(index, "title", value),
            }),
            h(VTextField, {
              modelValue: taskLink.url,
              label: "URL",
              placeholder: "https://example.com",
              variant: "outlined",
              density: "comfortable",
              hideDetails: true,
              "onUpdate:modelValue": (value: string | null) => updateLink(index, "url", value),
            }),
          ]),
          h(VBtn, {
            icon: "mdi-close",
            variant: "text",
            color: "error",
            "aria-label": "リンクを削除",
            onClick: () => removeLink(index),
          }),
        ])),
        props.helpText
          ? h("div", { class: "text-caption text-medium-emphasis" }, props.helpText)
          : null,
      ])
    }
  },
})
</script>
