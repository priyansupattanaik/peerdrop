"use client"

import { useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface TransferOrbProps {
  onClick: () => void
  isActive: boolean
  isTransferring: boolean
  progress: number
}

export function TransferOrb({ onClick, isActive, isTransferring, progress }: TransferOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Center coordinates
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const radius = Math.min(centerX, centerY) - 10

    // Animation variables
    let particles: { x: number; y: number; size: number; speed: number; angle: number; color: string }[] = []
    let hue = 180 // Start with cyan

    // Create particles
    const createParticles = () => {
      particles = []
      const particleCount = 50

      for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = Math.random() * radius * 0.8

        particles.push({
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
          size: Math.random() * 3 + 1,
          speed: Math.random() * 1 + 0.5,
          angle: Math.random() * Math.PI * 2,
          color: `hsl(${hue + Math.random() * 60}, 100%, 70%)`,
        })
      }
    }

    createParticles()

    // Animation loop
    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw outer circle
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.strokeStyle = isActive ? "rgba(6, 182, 212, 0.5)" : "rgba(100, 116, 139, 0.3)"
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw progress arc if transferring
      if (isTransferring && progress > 0) {
        const startAngle = -Math.PI / 2
        const endAngle = startAngle + Math.PI * 2 * (progress / 100)

        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, startAngle, endAngle)
        ctx.strokeStyle = "rgba(6, 182, 212, 0.8)"
        ctx.lineWidth = 4
        ctx.stroke()
      }

      // Draw inner glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)

      if (isActive) {
        gradient.addColorStop(0, "rgba(6, 182, 212, 0.3)")
        gradient.addColorStop(0.7, "rgba(6, 182, 212, 0.1)")
        gradient.addColorStop(1, "rgba(6, 182, 212, 0)")
      } else {
        gradient.addColorStop(0, "rgba(100, 116, 139, 0.1)")
        gradient.addColorStop(0.7, "rgba(100, 116, 139, 0.05)")
        gradient.addColorStop(1, "rgba(100, 116, 139, 0)")
      }

      ctx.fillStyle = gradient
      ctx.fill()

      // Update and draw particles
      if (isActive) {
        particles.forEach((particle) => {
          // Update position
          particle.x += Math.cos(particle.angle) * particle.speed
          particle.y += Math.sin(particle.angle) * particle.speed

          // Bounce off the edges
          const distance = Math.sqrt(Math.pow(particle.x - centerX, 2) + Math.pow(particle.y - centerY, 2))

          if (distance > radius - particle.size) {
            particle.angle = Math.atan2(centerY - particle.y, centerX - particle.x)

            particle.x += Math.cos(particle.angle) * particle.speed
            particle.y += Math.sin(particle.angle) * particle.speed
          }

          // Draw particle
          ctx.beginPath()
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
          ctx.fillStyle = particle.color
          ctx.fill()
        })

        // Slowly shift hue for color cycling effect
        hue = (hue + 0.2) % 360
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [isActive, isTransferring, progress])

  return (
    <motion.div
      className={cn("relative w-32 h-32 cursor-pointer select-none", isActive ? "opacity-100" : "opacity-50")}
      whileHover={isActive ? { scale: 1.05 } : {}}
      whileTap={isActive ? { scale: 0.95 } : {}}
      onClick={isActive ? onClick : undefined}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-medium text-cyan-400">{isTransferring ? `${progress}%` : "Send File"}</span>
      </div>
    </motion.div>
  )
}

