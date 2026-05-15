"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react"
import { Toast } from "radix-ui"

type ToastVariant = "error" | "success" | "info"

interface ToastMessage {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastOptions {
  title?: string
  description: string
  variant?: ToastVariant
}

interface ToastApi {
  notify: (options: ToastOptions) => void
  error: (description: string, title?: string) => void
  success: (description: string, title?: string) => void
  info: (description: string, title?: string) => void
}

const TOAST_META: Record<
  ToastVariant,
  {
    defaultTitle: string
    icon: LucideIcon
  }
> = {
  error: {
    defaultTitle: "發生錯誤",
    icon: AlertCircle,
  },
  success: {
    defaultTitle: "完成",
    icon: CheckCircle2,
  },
  info: {
    defaultTitle: "提醒",
    icon: Info,
  },
}

const ToastContext = createContext<ToastApi | null>(null)
const TOAST_DURATION_MS = 4500
const TOAST_EXIT_MS = 180

function ToastNotification({
  message,
  onRemove,
}: {
  message: ToastMessage
  onRemove: (id: number) => void
}) {
  const [open, setOpen] = useState(true)
  const ToastIcon = TOAST_META[message.variant].icon

  useEffect(() => {
    const closeTimer = window.setTimeout(
      () => setOpen(false),
      TOAST_DURATION_MS
    )
    return () => window.clearTimeout(closeTimer)
  }, [message.id])

  useEffect(() => {
    if (open) {
      return
    }

    const removeTimer = window.setTimeout(
      () => onRemove(message.id),
      TOAST_EXIT_MS
    )
    return () => window.clearTimeout(removeTimer)
  }, [message.id, onRemove, open])

  return (
    <Toast.Root
      className={`app-toast is-${message.variant}`}
      onOpenChange={setOpen}
      open={open}
      type="background"
    >
      <div className="toast-icon" aria-hidden="true">
        <ToastIcon size={17} strokeWidth={2.25} />
      </div>
      <div className="toast-copy">
        <Toast.Title className="toast-title">{message.title}</Toast.Title>
        <Toast.Description className="toast-description">
          {message.description}
        </Toast.Description>
      </div>
      <Toast.Close aria-label="關閉通知" className="toast-close">
        <X aria-hidden="true" size={15} />
      </Toast.Close>
    </Toast.Root>
  )
}

export function ToastNotificationsProvider({
  children,
}: {
  children: ReactNode
}) {
  const nextId = useRef(0)
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id))
  }, [])

  const notify = useCallback((options: ToastOptions) => {
    const id = nextId.current
    nextId.current += 1
    setMessages((current) => [
      ...current.slice(-3),
      {
        id,
        title:
          options.title ?? TOAST_META[options.variant ?? "info"].defaultTitle,
        description: options.description,
        variant: options.variant ?? "info",
      },
    ])
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      error: (description, title = "發生錯誤") =>
        notify({ description, title, variant: "error" }),
      success: (description, title = "完成") =>
        notify({ description, title, variant: "success" }),
      info: (description, title = "提醒") =>
        notify({ description, title, variant: "info" }),
    }),
    [notify]
  )

  return (
    <Toast.Provider swipeDirection="right">
      <ToastContext.Provider value={api}>{children}</ToastContext.Provider>
      {messages.map((message) => (
        <ToastNotification
          key={message.id}
          message={message}
          onRemove={dismiss}
        />
      ))}
      <Toast.Viewport className="toast-viewport" />
    </Toast.Provider>
  )
}

export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) {
    throw new Error("useToast must be used within ToastNotificationsProvider.")
  }
  return toast
}
