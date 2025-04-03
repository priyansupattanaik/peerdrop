"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Peer } from "peerjs";
import { QRCodeSVG } from "qrcode.react";
import {
  Send,
  Download,
  Wifi,
  Bluetooth,
  RefreshCw,
  HelpCircle,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import NetworkDetector from "@/components/network-detector";
import ChatAssistant from "@/components/chat-assistant";
import { TransferOrb } from "@/components/transfer-orb";

// File chunk size (1MB)
const CHUNK_SIZE = 1024 * 1024;

export default function FileTransferApp() {
  const [peerId, setPeerId] = useState<string>("");
  const [remotePeerId, setRemotePeerId] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transferProgress, setTransferProgress] = useState<number>(0);
  const [transferStatus, setTransferStatus] = useState<
    "idle" | "sending" | "receiving" | "complete" | "error"
  >("idle");
  const [showAssistant, setShowAssistant] = useState<boolean>(false);
  const [networkType, setNetworkType] = useState<
    "wifi" | "bluetooth" | "webrtc"
  >("webrtc");
  const [receivedFiles, setReceivedFiles] = useState<
    { name: string; url: string; size: number }[]
  >([]);

  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<any>(null);
  const fileChunksRef = useRef<{
    [key: string]: {
      chunks: Array<Blob>;
      name: string;
      size: number;
    };
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  // Initialize PeerJS
  useEffect(() => {
    const initPeer = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const peer = new Peer({
          debug: 2,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
            ],
          },
        });

        peer.on("open", (id) => {
          setPeerId(id);
          toast({
            title: "Connected to signaling server",
            description: `Your ID: ${id}`,
          });
        });

        peer.on("connection", (conn) => {
          handleIncomingConnection(conn);
        });

        peer.on("error", (err) => {
          console.error("PeerJS error:", err);
          toast({
            variant: "destructive",
            title: "Connection Error",
            description: "Failed to establish connection. Retrying...",
          });

          // Auto-retry connection after error
          setTimeout(() => {
            if (peerRef.current) {
              peerRef.current.destroy();
              peerRef.current = null;
            }
            initPeer();
          }, 3000);
        });

        peerRef.current = peer;
      } catch (error) {
        console.error("Failed to initialize PeerJS:", error);
        toast({
          variant: "destructive",
          title: "Initialization Failed",
          description: "Could not initialize connection. Please try again.",
        });
      }
    };

    initPeer();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [toast]);

  const handleIncomingConnection = (conn: any) => {
    connectionRef.current = conn;
    setConnectionStatus("connecting");

    conn.on("open", () => {
      setConnectionStatus("connected");
      setRemotePeerId(conn.peer);
      toast({
        title: "Peer Connected",
        description: `Connected to peer: ${conn.peer.substring(0, 8)}...`,
      });
    });

    conn.on("data", (data: any) => {
      handleIncomingData(data);
    });

    conn.on("close", () => {
      setConnectionStatus("disconnected");
      toast({
        title: "Peer Disconnected",
        description: "The connection was closed",
      });
    });

    conn.on("error", (err: any) => {
      console.error("Connection error:", err);
      setConnectionStatus("disconnected");
      setTransferStatus("error");
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "An error occurred with the connection",
      });
    });
  };

  const connectToPeer = () => {
    if (!peerRef.current || !remotePeerId) return;

    try {
      setConnectionStatus("connecting");
      const conn = peerRef.current.connect(remotePeerId, {
        reliable: true,
      });

      connectionRef.current = conn;

      conn.on("open", () => {
        setConnectionStatus("connected");
        toast({
          title: "Connected",
          description: `Connected to peer: ${remotePeerId.substring(0, 8)}...`,
        });
      });

      conn.on("data", (data: any) => {
        handleIncomingData(data);
      });

      conn.on("close", () => {
        setConnectionStatus("disconnected");
        toast({
          title: "Peer Disconnected",
          description: "The connection was closed",
        });
      });

      conn.on("error", (err: any) => {
        console.error("Connection error:", err);
        setConnectionStatus("disconnected");
        setTransferStatus("error");
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "An error occurred with the connection",
        });
      });
    } catch (error) {
      console.error("Failed to connect to peer:", error);
      setConnectionStatus("disconnected");
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Could not connect to the specified peer",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      toast({
        title: "File Selected",
        description: `${files[0].name} (${formatFileSize(files[0].size)})`,
      });
    }
  };

  const sendFile = async () => {
    if (!connectionRef.current || !selectedFile) return;

    try {
      setTransferStatus("sending");
      setTransferProgress(0);

      // Send file metadata first
      connectionRef.current.send({
        type: "file-meta",
        name: selectedFile.name,
        size: selectedFile.size,
        fileId: generateFileId(),
      });

      // Split file into chunks and send
      const chunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
      const fileReader = new FileReader();

      let currentChunk = 0;

      fileReader.onload = (e) => {
        if (e.target?.result && connectionRef.current) {
          connectionRef.current.send({
            type: "file-chunk",
            data: e.target.result,
            chunk: currentChunk,
            chunks: chunks,
          });

          currentChunk++;
          setTransferProgress(Math.round((currentChunk / chunks) * 100));

          if (currentChunk < chunks) {
            loadNextChunk();
          } else {
            // Transfer complete
            setTimeout(() => {
              setTransferStatus("complete");
              toast({
                title: "Transfer Complete",
                description: `${selectedFile.name} was sent successfully`,
              });
            }, 500);
          }
        }
      };

      const loadNextChunk = () => {
        const start = currentChunk * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        const blob = selectedFile.slice(start, end);
        fileReader.readAsArrayBuffer(blob);
      };

      loadNextChunk();
    } catch (error) {
      console.error("Error sending file:", error);
      setTransferStatus("error");
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: "Failed to send the file. Please try again.",
      });
    }
  };

  const handleIncomingData = (data: any) => {
    if (data.type === "file-meta") {
      // Prepare to receive file chunks
      setTransferStatus("receiving");
      setTransferProgress(0);

      const fileId = data.fileId || generateFileId();
      fileChunksRef.current[fileId] = {
        chunks: [],
        name: data.name,
        size: data.size,
      };

      toast({
        title: "Receiving File",
        description: `${data.name} (${formatFileSize(data.size)})`,
      });
    } else if (data.type === "file-chunk") {
      // Process file chunk
      const fileId = Object.keys(fileChunksRef.current)[0]; // Assuming one file at a time

      if (fileChunksRef.current[fileId]) {
        // Convert ArrayBuffer to Blob
        const blob = new Blob([data.data]);
        fileChunksRef.current[fileId].chunks.push(blob);

        // Update progress
        setTransferProgress(Math.round(((data.chunk + 1) / data.chunks) * 100));

        // Check if all chunks received
        if (data.chunk + 1 === data.chunks) {
          // Combine chunks and create download URL
          const completeFile = new Blob(fileChunksRef.current[fileId].chunks, {
            type: "application/octet-stream",
          });
          const downloadUrl = URL.createObjectURL(completeFile);

          const fileName = fileChunksRef.current[fileId].name;

          // Add to received files with original filename
          setReceivedFiles((prev) => [
            ...prev,
            {
              name: fileName,
              url: downloadUrl,
              size: completeFile.size,
            },
          ]);

          // Reset for next file
          delete fileChunksRef.current[fileId];

          setTransferStatus("complete");
          toast({
            title: "Transfer Complete",
            description: "File received successfully",
          });
        }
      }
    }
  };

  const generateFileId = () => {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    else return (bytes / 1073741824).toFixed(1) + " GB";
  };

  const resetTransfer = () => {
    setTransferStatus("idle");
    setTransferProgress(0);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadFile = (url: string, filename: string) => {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "downloaded_file";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Small delay before removing the element
      setTimeout(() => {
        document.body.removeChild(a);
        // Optionally revoke the object URL to free up memory
        // URL.revokeObjectURL(url)
      }, 100);

      toast({
        title: "Download Started",
        description: `Downloading ${filename}`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Could not download the file. Please try again.",
      });
    }
  };

  const getAppStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-500";
      case "connecting":
        return "bg-yellow-500";
      case "disconnected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="w-full max-w-4xl px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-600">
          Peer Drop
        </h1>
        <div className="flex items-center gap-2">
          <div
            className={cn("w-3 h-3 rounded-full", getAppStatusColor())}
          ></div>
          <span className="text-sm text-gray-300">
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAssistant(!showAssistant)}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-black/40 backdrop-blur-md border-gray-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden">
          <CardContent className="p-6">
            <Tabs defaultValue="send" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-900/50">
                <TabsTrigger
                  value="send"
                  className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </TabsTrigger>
                <TabsTrigger
                  value="receive"
                  className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Receive
                </TabsTrigger>
              </TabsList>

              <TabsContent value="send" className="space-y-4">
                <div className="text-center">
                  <p className="text-gray-400 mb-4">
                    Your ID:{" "}
                    <span className="font-mono text-cyan-400">
                      {peerId || "Connecting..."}
                    </span>
                  </p>

                  {peerId && (
                    <div className="flex justify-center mb-4">
                      <div className="p-2 bg-white rounded-lg">
                        <QRCodeSVG
                          value={peerId}
                          size={150}
                          level="H"
                          className={cn(
                            "transition-all duration-500",
                            connectionStatus === "connected"
                              ? "opacity-50"
                              : "opacity-100"
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={remotePeerId}
                        onChange={(e) => setRemotePeerId(e.target.value)}
                        placeholder="Enter recipient's ID"
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <Button
                        onClick={connectToPeer}
                        disabled={
                          !remotePeerId || connectionStatus === "connected"
                        }
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                      >
                        Connect
                      </Button>
                    </div>

                    {connectionStatus === "connected" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center">
                          <TransferOrb
                            onClick={() => fileInputRef.current?.click()}
                            isActive={connectionStatus === "connected"}
                            isTransferring={transferStatus === "sending"}
                            progress={transferProgress}
                          />
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </div>

                        {selectedFile && transferStatus === "idle" && (
                          <div className="p-3 bg-gray-800/50 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium truncate">
                                {selectedFile.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatFileSize(selectedFile.size)}
                              </p>
                            </div>
                            <Button
                              onClick={sendFile}
                              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                            >
                              Send
                            </Button>
                          </div>
                        )}

                        {(transferStatus === "sending" ||
                          transferStatus === "receiving") && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>
                                {transferStatus === "sending"
                                  ? "Sending..."
                                  : "Receiving..."}
                              </span>
                              <span>{transferProgress}%</span>
                            </div>
                            <Progress
                              value={transferProgress}
                              className="h-2"
                            />
                          </div>
                        )}

                        {transferStatus === "complete" && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-green-900/20 border border-green-800 rounded-lg flex items-center justify-between"
                          >
                            <div className="flex items-center">
                              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                              <span>Transfer complete!</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetTransfer}
                            >
                              New Transfer
                            </Button>
                          </motion.div>
                        )}

                        {transferStatus === "error" && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center justify-between"
                          >
                            <div className="flex items-center">
                              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                              <span>Transfer failed</span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetTransfer}
                            >
                              Try Again
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="receive" className="space-y-4">
                <div className="text-center">
                  <p className="text-gray-400 mb-4">
                    Your ID:{" "}
                    <span className="font-mono text-purple-400">
                      {peerId || "Connecting..."}
                    </span>
                  </p>

                  {peerId && (
                    <div className="flex justify-center mb-4">
                      <div className="p-2 bg-white rounded-lg">
                        <QRCodeSVG
                          value={peerId}
                          size={150}
                          level="H"
                          className={cn(
                            "transition-all duration-500",
                            connectionStatus === "connected"
                              ? "opacity-50"
                              : "opacity-100"
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {connectionStatus === "connected" ? (
                    <div className="p-3 bg-green-900/20 border border-green-800 rounded-lg">
                      <p className="flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                        Connected to peer
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Ready to receive files
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-gray-300">
                        Share your ID or QR code with the sender
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Waiting for connection...
                      </p>
                    </div>
                  )}

                  {transferStatus === "receiving" && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Receiving...</span>
                        <span>{transferProgress}%</span>
                      </div>
                      <Progress value={transferProgress} className="h-2" />
                    </div>
                  )}

                  {receivedFiles.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium mb-3">
                        Received Files
                      </h3>
                      <div className="space-y-2">
                        {receivedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="p-3 bg-gray-800/50 rounded-lg flex items-center justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFile(file.url, file.name)}
                            >
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-black/40 backdrop-blur-md border-gray-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                Connection Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    Network Type
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={networkType === "wifi" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNetworkType("wifi")}
                      className={
                        networkType === "wifi"
                          ? "bg-cyan-600 hover:bg-cyan-700"
                          : ""
                      }
                    >
                      <Wifi className="h-4 w-4 mr-2" />
                      Wi-Fi
                    </Button>
                    <Button
                      variant={
                        networkType === "bluetooth" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setNetworkType("bluetooth")}
                      className={
                        networkType === "bluetooth"
                          ? "bg-blue-600 hover:bg-blue-700"
                          : ""
                      }
                    >
                      <Bluetooth className="h-4 w-4 mr-2" />
                      Bluetooth
                    </Button>
                    <Button
                      variant={networkType === "webrtc" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNetworkType("webrtc")}
                      className={
                        networkType === "webrtc"
                          ? "bg-purple-600 hover:bg-purple-700"
                          : ""
                      }
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      WebRTC
                    </Button>
                  </div>
                </div>

                <NetworkDetector />

                {connectionStatus === "connected" && (
                  <div className="p-3 bg-gray-800/50 rounded-lg">
                    <h3 className="text-sm font-medium mb-2">
                      Active Connection
                    </h3>
                    <div className="flex justify-between text-sm">
                      <span>Peer ID:</span>
                      <span className="font-mono text-cyan-400">
                        {remotePeerId.substring(0, 12)}...
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span>Connection Type:</span>
                      <span>{networkType.toUpperCase()}</span>
                    </div>
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-red-400 hover:text-red-300 hover:bg-red-950"
                        onClick={() => {
                          if (connectionRef.current) {
                            connectionRef.current.close();
                          }
                          setConnectionStatus("disconnected");
                          setRemotePeerId("");
                        }}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <AnimatePresence>
            {showAssistant && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="bg-black/40 backdrop-blur-md border-gray-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden">
                  <CardContent className="p-6 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setShowAssistant(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <ChatAssistant />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Toaster />
    </div>
  );
}
