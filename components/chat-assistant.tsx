"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// Predefined responses for common issues
const RESPONSES = {
  connection:
    "Connection issues can be caused by firewall settings or network restrictions. Try these steps:\n\n1. Check if you're behind a corporate firewall\n2. Try using a different network\n3. Ensure WebRTC is not blocked in your browser",
  transfer:
    "File transfer problems are often related to file size or connection stability. Try:\n\n1. Sending a smaller file first\n2. Ensuring both devices stay on the same network\n3. Checking your browser's storage permissions",
  qrcode:
    "QR code scanning issues? Make sure:\n\n1. Your camera has permission to be used by the browser\n2. The QR code is well-lit and clearly visible\n3. You're using a supported browser (Chrome, Firefox, Safari)",
  general:
    "Quantum Share uses WebRTC for secure peer-to-peer file transfers. Your files are sent directly between devices without going through a server. For best results, keep both devices on the same network.",
}

type Message = {
  role: "user" | "assistant"
  content: string
}

export default function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi there! I'm your Quantum Share assistant. How can I help you with file sharing today?",
    },
  ])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSend = () => {
    if (!input.trim()) return

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: input }])

    // Process query and generate response
    setTimeout(() => {
      const response = generateResponse(input)
      setMessages((prev) => [...prev, { role: "assistant", content: response }])
    }, 500)

    setInput("")
  }

  const generateResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase()

    if (lowerQuery.includes("connect") || lowerQuery.includes("peer") || lowerQuery.includes("id")) {
      return RESPONSES.connection
    } else if (lowerQuery.includes("file") || lowerQuery.includes("transfer") || lowerQuery.includes("send")) {
      return RESPONSES.transfer
    } else if (lowerQuery.includes("qr") || lowerQuery.includes("scan") || lowerQuery.includes("camera")) {
      return RESPONSES.qrcode
    } else {
      return RESPONSES.general
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col h-[350px]">
      <h2 className="text-xl font-semibold mb-4">Help Assistant</h2>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-1">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-2",
              message.role === "assistant" ? "text-left" : "text-right flex-row-reverse",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full shrink-0",
                message.role === "assistant" ? "bg-cyan-900/50" : "bg-purple-900/50",
              )}
            >
              {message.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>
            <div
              className={cn(
                "rounded-lg px-3 py-2 max-w-[85%] text-sm",
                message.role === "assistant"
                  ? "bg-cyan-950/40 border border-cyan-900/50 text-left"
                  : "bg-purple-950/40 border border-purple-900/50 text-left",
              )}
            >
              {message.content.split("\n").map((line, i) => (
                <p key={i} className={i > 0 ? "mt-2" : ""}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for help..."
          className="min-h-[60px] bg-gray-800/50 border-gray-700 resize-none"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim()}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

