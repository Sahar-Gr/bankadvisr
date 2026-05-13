import React from 'react';
import { Ghost } from 'lucide-react'; // Ou n'importe quelle icône de ta bibliothèque

export default function EmptyState({ message, subMessage, icon: Icon = Ghost }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-bg-surface/50 border-2 border-dashed border-border-soft rounded-2xl animate-fade-in">
      <div className="p-4 bg-brand/10 rounded-full mb-4">
        <Icon className="h-10 w-10 text-brand opacity-70" />
      </div>
      <h3 className="text-lg font-bold text-text-primary">{message}</h3>
      {subMessage && <p className="text-text-secondary mt-2 max-w-xs">{subMessage}</p>}
    </div>
  );
}