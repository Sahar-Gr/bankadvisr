import React, { useEffect, useState, useRef } from "react";
import { db } from "../../firebase/firebase";
import { 
  collection, addDoc, query, orderBy, 
  onSnapshot, serverTimestamp 
} from "firebase/firestore";
import { Send, User } from "lucide-react";

export default function ProjectChat({ projectId, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef();

  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, "projects", projectId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [projectId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, "projects", projectId, "messages"), {
        text: newMessage.trim(),
        senderUid: currentUser.uid,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        createdAt: serverTimestamp(),
      });
      setNewMessage("");
    } catch (error) {
      console.error("Erreur d'envoi:", error);
    }
  };

  return (
    <div className="app-card flex flex-col h-[600px] overflow-hidden border-t-4 border-brand shadow-xl">
      {/* Header */}
      <div className="p-5 border-b border-border-soft bg-bg-muted/30 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-xl text-text-primary tracking-tight">Espace Discussion</h3>
          <p className="text-sm text-text-muted italic">Échanges officiels sur le projet</p>
        </div>
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-bg-page/50 backdrop-blur-sm">
        {messages.map((m) => {
          const isMe = m.senderUid === currentUser.uid;
          const displayName = isMe ? "Moi" : m.senderName;

          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div 
                className={`group relative max-w-[80%] p-4 rounded-2xl shadow-xl transition-all border border-black/5 dark:border-white/10 ${
                  isMe ? "rounded-tr-none" : "rounded-tl-none"
                }`}
                style={{ 
                  // Opacité légèrement plus forte (0.12) pour que la bulle soit visible sur fond clair
                  backgroundColor: 'rgba(120, 120, 120, 0.12)', 
                  backdropFilter: 'blur(12px)' 
                }}
              >
                {/* Badge Identité */}
                <div className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2 border-b border-black/5 dark:border-white/5 pb-1 ${
                  isMe ? "text-brand justify-end" : "text-text-secondary"
                }`}>
                  {!isMe && <User size={12} />}
                  {displayName}
                  <span className="text-[8px] px-1 bg-black/5 dark:bg-white/10 rounded opacity-50">{m.senderRole}</span>
                </div>

                {/* Texte du message - ADAPTATIF : Noir en clair / Blanc en sombre */}
                <div className="text-[16px] leading-relaxed font-semibold whitespace-pre-wrap break-words text-slate-900 dark:text-white">
                  {m.text}
                </div>

                {/* Heure - Adaptatif également */}
                <div className="text-[10px] mt-2 font-bold opacity-50 text-right text-slate-700 dark:text-white/70">
                   {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "..."}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Formulaire d'envoi */}
      <form onSubmit={handleSend} className="p-5 bg-bg-surface border-t border-border-soft flex gap-3 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrivez votre message ici..."
            className="app-input w-full pr-12 py-4 text-base bg-bg-muted/20 border-border-strong focus:border-brand transition-all rounded-xl"
          />
        </div>
        <button 
          type="submit" 
          disabled={!newMessage.trim()}
          className="app-btn app-btn-primary p-4 rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all shadow-lg"
        >
          <Send className="h-6 w-6" />
        </button>
      </form>
    </div>
  );
}