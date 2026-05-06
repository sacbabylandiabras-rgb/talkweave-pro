import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image, ExternalLink, Phone } from "lucide-react";

interface CarouselCard {
  id: string;
  image: string;
  title: string;
  description: string;
  buttons?: Array<{
    id: string;
    text: string;
     type: 'url' | 'call' | 'reply' | 'copy';
    value?: string;
    url?: string;
    phone?: string;
  }>;
}

interface CarouselPreviewProps {
  cards: CarouselCard[];
  header?: string;
  footer?: string;
  content?: string;
}

export function CarouselPreview({ cards, header, footer, content }: CarouselPreviewProps) {
  if (!cards || cards.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>Nenhum card de carrossel configurado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      {header && (
        <div className="text-sm font-medium text-muted-foreground">
          {header}
        </div>
      )}

      {/* Content */}
      {content && (
        <div className="text-sm whitespace-pre-wrap">
          {content}
        </div>
      )}

      {/* Carousel Cards */}
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {cards.map((card, index) => (
          <Card 
            key={card.id} 
            className="min-w-[280px] max-w-[280px] snap-start flex-shrink-0 overflow-hidden"
          >
            {/* Card Image */}
            {card.image && card.image.trim() !== '' ? (
              <div className="relative w-full h-40 bg-muted flex items-center justify-center overflow-hidden">
                <img 
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = `
                      <div class="flex flex-col items-center justify-center w-full h-full text-muted-foreground">
                        <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span class="text-xs">Imagem não disponível</span>
                      </div>
                    `;
                  }}
                />
                <Badge className="absolute top-2 right-2 bg-background/80 backdrop-blur">
                  {index + 1}/{cards.length}
                </Badge>
              </div>
            ) : (
              <div className="relative w-full h-40 bg-muted flex flex-col items-center justify-center text-muted-foreground">
                <Image className="w-12 h-12 mb-2" />
                <span className="text-xs">Sem imagem</span>
                <Badge className="absolute top-2 right-2 bg-background/80 backdrop-blur">
                  {index + 1}/{cards.length}
                </Badge>
              </div>
            )}

            <CardContent className="p-4 space-y-3">
              {/* Card Title */}
              <h4 className="font-semibold text-sm whitespace-pre-wrap break-words">
                {card.title || 'Sem título'}
              </h4>

              {/* Card Description */}
              {card.description && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                  {card.description}
                </p>
              )}

              {/* Card Buttons */}
              {card.buttons && card.buttons.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  {card.buttons.map((button) => (
                    <Button
                      key={button.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 h-8 text-xs"
                      disabled
                    >
                      {button.type === 'url' && <ExternalLink className="w-3 h-3" />}
                      {button.type === 'call' && <Phone className="w-3 h-3" />}
                      <span className="truncate">{button.text}</span>
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer */}
      {footer && (
        <div className="text-xs text-muted-foreground">
          {footer}
        </div>
      )}

      {/* Info Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-xs">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}
        </Badge>
        <span>•</span>
        <span>Arraste para ver todos os cards →</span>
      </div>
    </div>
  );
}
