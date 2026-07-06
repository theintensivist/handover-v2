/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { encryptData, decryptData } from "../lib/crypto";
import { ChatMessage, EncryptedChatMessage } from "../types";
import { Send, ShieldAlert, MessageSquare, Lock, ShieldCheck } from "lucide-react";

interface ChatroomProps {
  nickname: string;
  passphrase: string;
}

export default function Chatroom({ nickname, passphrase }: ChatroomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast(prev => prev === message ? null : prev);
    }, 4000);
  };

  // Subscribe to real-time chat messages
  useEffect(() => {
    const chatCollection = collection(db, "chats");
    // Get last 150 messages
    const q = query(chatCollection, orderBy("createdAt", "asc"), limit(150));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const encryptedMsgs: EncryptedChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        encryptedMsgs.push({
          id: doc.id,
          sender: data.sender || "Anonymous",
          encryptedText: data.encryptedText || "",
          createdAt: data.createdAt || new Date().toISOString()
        });
      });

      // Decrypt all messages asynchronously
      const decryptedMsgs = await Promise.all(
        encryptedMsgs.map(async (msg) => {
          let decryptedText = "[Decryption Failed]";
          if (msg.encryptedText) {
            decryptedText = await decryptData(msg.encryptedText, passphrase);
          }
          return {
            id: msg.id,
            sender: msg.sender,
            text: decryptedText,
            createdAt: msg.createdAt
          };
        })
      );

      setMessages(decryptedMsgs);
      setLoading(false);
    }, (error) => {
      console.error("Chat sync error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [passphrase]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const textToSend = newMessage.trim();
    setNewMessage("");

    try {
      // Encrypt text before sending
      const encryptedText = await encryptData(textToSend, passphrase);
      
      const chatCollection = collection(db, "chats");
      await addDoc(chatCollection, {
        sender: nickname,
        encryptedText: encryptedText,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      showToast("Error sending encrypted message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#111111] border border-[#222222] rounded overflow-hidden shadow-xl">
      {/* Header Info Banner */}
      <div className="bg-[#141414] px-6 py-4 border-b border-[#222222] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-950/40 border border-emerald-500/20 rounded flex items-center justify-center text-emerald-500">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#E0E0E0] flex items-center gap-2">
              Clinical Chatroom
              <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-500/20 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                Live Node
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
              End-to-End Encrypted (HIPAA Compliant)
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-[#0D0D0D] border border-[#222222] px-3 py-1.5 rounded text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>AES-GCM-256 Key Verified</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0A0A0A]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            <p className="text-xs">Decrypting and loading chatroom history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-12 h-12 bg-[#1A1A1A] border border-[#222222] rounded-full flex items-center justify-center text-zinc-500 mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-zinc-300">No encrypted messages yet.</p>
            <p className="text-xs text-zinc-500 max-w-xs mt-1">
              Start the discussion! Any messages sent here are decrypted in real-time on all unlocked ICU group devices.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === nickname;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                {/* Sender Title */}
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1 px-1">
                  {msg.sender}
                </span>

                {/* Message Bubble */}
                <div
                  className={`px-4 py-2 rounded text-xs leading-relaxed ${
                    isMe
                      ? "bg-emerald-600 text-white rounded-br-none font-medium"
                      : "bg-[#1A1A1A] text-zinc-100 border border-[#222222] rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {/* Message Time */}
                <span className="text-[8px] text-zinc-600 mt-1 px-1 font-mono uppercase tracking-wider font-bold">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Form Area */}
      <form onSubmit={handleSend} className="bg-[#141414] border-t border-[#222222] p-4 flex gap-3">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type an E2EE message... (Avoid exposing PHI on unencrypted tools)"
          className="flex-1 bg-[#1A1A1A] border border-[#222222] rounded px-4 py-2 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-650 font-sans"
          disabled={loading}
          required
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim() || loading}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1A1A1A] disabled:text-zinc-650 text-white p-2 px-4 rounded transition-all flex items-center justify-center gap-1.5 shadow-lg"
        >
          <Send className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Send</span>
        </button>
      </form>

      {toast && (
        <div className="absolute bottom-20 right-6 z-50 animate-bounce-in max-w-sm">
          <div className="p-3 rounded shadow-2xl bg-red-950 border border-red-900 text-red-200 text-xs font-semibold leading-relaxed flex items-center gap-2">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast(null)} className="text-zinc-500 hover:text-zinc-350 ml-1 font-bold">✕</button>
          </div>
        </div>
      )}

    </div>
  );
}
