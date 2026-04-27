import { Send } from "lucide-react";

interface TelegramPlaceholderProps {
  title: string;
  description?: string;
}

export default function TelegramPlaceholder({ title, description }: TelegramPlaceholderProps) {
  return (
    <div className="p-6">
      <div className="glass-card rounded-2xl p-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(96,165,250,0.18)] border border-[rgba(96,165,250,0.30)] flex items-center justify-center">
            <Send className="w-5 h-5 text-[#60a5fa]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <p className="text-sm text-white/60">Telegram</p>
          </div>
        </div>
        <p className="text-white/70 text-sm leading-relaxed">
          {description ??
            "Esta seção do Telegram está em construção. A integração será feita via BotFather usando a Bot API oficial do Telegram."}
        </p>
        <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-white/50 mb-1">Documentação oficial</p>
          <a
            href="https://core.telegram.org/bots/api"
            target="_blank"
            rel="noreferrer"
            className="text-[#60a5fa] text-sm hover:underline"
          >
            core.telegram.org/bots/api
          </a>
        </div>
      </div>
    </div>
  );
}