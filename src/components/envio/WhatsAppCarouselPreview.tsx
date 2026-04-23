import { Image as ImageIcon, Link as LinkIcon, MessageCircle, Phone } from "lucide-react";

type CarouselButton = {
  id: string;
  text: string;
  type: 'reply' | 'url' | 'call';
  value?: string;
};

type CarouselCard = {
  id: string;
  image: string;
  title: string;
  description: string;
  buttons: CarouselButton[];
};

interface WhatsAppCarouselPreviewProps {
  header?: string;
  content?: string;
  footer?: string;
  cards?: CarouselCard[];
  showHint?: boolean;
  className?: string;
}

const getButtonIcon = (type: CarouselButton['type']) => {
  switch (type) {
    case 'url':
      return LinkIcon;
    case 'call':
      return Phone;
    default:
      return MessageCircle;
  }
};

export default function WhatsAppCarouselPreview({
  header,
  content,
  footer,
  cards = [],
  showHint = true,
  className = "",
}: WhatsAppCarouselPreviewProps) {
  if (!cards.length) return null;

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {header ? (
        <p className="text-[11px] font-semibold uppercase text-muted-foreground">
          {header}
        </p>
      ) : null}

      {content ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {content}
        </p>
      ) : null}

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex w-max gap-3 snap-x snap-mandatory">
          {cards.map((card, index) => (
            <div
              key={card.id || `${card.title}-${index}`}
              className="snap-start shrink-0 overflow-hidden rounded-2xl border border-border bg-background shadow-sm w-[228px]"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                {card.image ? (
                  <img
                    src={card.image}
                    alt={card.title || `Card ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-10 w-10" />
                    <span className="text-xs">Imagem do card</span>
                  </div>
                )}

                <span className="absolute right-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm">
                  {index + 1}/{cards.length}
                </span>
              </div>

              <div className="space-y-2 p-3">
                {card.title ? (
                  <p className="text-sm font-semibold leading-tight text-foreground">
                    {card.title}
                  </p>
                ) : null}

                {card.description ? (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                ) : null}
              </div>

              {card.buttons?.length ? (
                <div className="border-t border-border/60 bg-muted/20">
                  {card.buttons.slice(0, 3).map((button, buttonIndex) => {
                    const Icon = getButtonIcon(button.type);

                    return (
                      <div
                        key={button.id || `${button.text}-${buttonIndex}`}
                        className="flex items-center justify-center gap-2 border-b border-border/50 px-3 py-2 text-sm font-medium text-primary last:border-b-0"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{button.text || 'Botão'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {footer ? (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">
          {footer}
        </p>
      ) : null}

      {showHint && cards.length > 1 ? (
        <p className="text-[11px] text-muted-foreground">
          Deslize para ver os outros cards.
        </p>
      ) : null}
    </div>
  );
}