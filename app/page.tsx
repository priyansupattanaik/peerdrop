import FileTransferApp from "@/components/file-transfer-app"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-slate-900 to-black text-white">
      <FileTransferApp />
    </main>
  )
}

