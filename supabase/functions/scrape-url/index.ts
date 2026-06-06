import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url, action, content } = body;

    // Handle FAQ generation action
    if (action === "generate-faqs") {
      if (!LOVABLE_API_KEY && !ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ error: "API Key não configurada (LOVABLE ou ANTHROPIC)" }), { status: 500, headers: corsHeaders });
      }


      let contentToUse = content;

      if (!contentToUse && url) {
        try {
          let formattedUrl = url.trim();
          if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
            formattedUrl = `https://${formattedUrl}`;
          }
          const scrapeRes = await fetch(formattedUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
          });
          if (scrapeRes.ok) {
            contentToUse = await scrapeRes.text();
            contentToUse = contentToUse.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").substring(0, 15000);
          }
        } catch (e) { console.error("Internal scrape failed:", e); }
      }

      let aiResponse;
      const isAnthropic = ANTHROPIC_API_KEY && (ANTHROPIC_API_KEY.startsWith("sk-ant-") || ANTHROPIC_API_KEY.startsWith("sk-"));
      console.log(`AI Provider decision: ${isAnthropic ? 'Anthropic' : 'Lovable/Gateway'}. Key available: ${!!ANTHROPIC_API_KEY}. Prefix: ${ANTHROPIC_API_KEY?.substring(0, 7)}`);


      if (isAnthropic) {
        aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 2048,
            messages: [
              {
                role: "user",
                content: `Você é um especialista em e-commerce e infoprodutos. Analise minuciosamente o conteúdo abaixo. Identifique: nicho, horário de atendimento, prazos de entrega, reembolso, rastreio e garantia. Gere EXATAMENTE 10 FAQs realistas.\n\nCONTEÚDO:\n${contentToUse || "Sem conteúdo disponível."}\n\nRetorne APENAS um JSON puro (sem markdown) no formato: {"faqs": [{"question": "...", "answer": "..."}, ...]}`
              }
            ],
          }),
        });
      } else {
        aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "system",
                content: "Você é um especialista em e-commerce e infoprodutos. Analise minuciosamente o conteúdo. Identifique: nicho, horário de atendimento, prazos de entrega, reembolso, rastreio e garantia. Gere EXATAMENTE 10 FAQs realistas. Retorne APENAS um JSON: {\"faqs\": [{\"question\": \"...\", \"answer\": \"...\"}, ...]}"
              },
              {
                role: "user",
                content: `Analise este conteúdo e gere 10 FAQs detalhadas:\n\n${contentToUse || "Sem conteúdo disponível."}`
              }
            ],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" }
          }),
        });
      }

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI API Error:", errorText);
        return new Response(JSON.stringify({ error: `Erro na IA (${isAnthropic ? 'Anthropic' : 'Lovable'}): ${aiResponse.status}` }), { status: aiResponse.status, headers: corsHeaders });
      }
      
      const aiData = await aiResponse.json();
      let aiContent;
      if (isAnthropic) {
        aiContent = cleanJson(aiData.content[0].text);
      } else {
        aiContent = cleanJson(aiData.choices[0].message.content);
      }

      
      return new Response(aiContent, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping URL:", formattedUrl);

    const response = await fetch(formattedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Erro ao acessar a URL: ${response.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();

    // Convert <a> tags to markdown links BEFORE stripping other tags to preserve URLs
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
      .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, linkText) => {
        const cleanText = linkText.replace(/<[^>]+>/g, "").trim();
        // Skip common navigation/utility links to avoid noise
        const noiseTerms = ["login", "entrar", "conta", "carrinho", "cart", "ajuda", "suporte"];
        if (noiseTerms.some(term => cleanText.toLowerCase().includes(term))) return "";
        
        if (href && cleanText && !href.startsWith("#") && !href.startsWith("javascript:")) {
          let fullUrl = href;
          try { fullUrl = new URL(href, formattedUrl).href; } catch {}
          return ` ${cleanText} ( ${fullUrl} ) `;
        }
        return ` ${cleanText} `;
      })
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to ~10000 chars to avoid huge prompts
    if (text.length > 10000) {
      text = text.substring(0, 10000) + "...";
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : new URL(formattedUrl).hostname;

    console.log(`Scraped ${text.length} chars from ${formattedUrl}`);

    // Use AI to extract clean information if we have a key
    let finalContent = text;
    let finalTitle = title;
    
    if ((LOVABLE_API_KEY || ANTHROPIC_API_KEY) && text.length > 100) {
      try {
        console.log("Using AI to refine extracted content...");
        let aiResponse;
        const isAnthropic = ANTHROPIC_API_KEY && (ANTHROPIC_API_KEY.startsWith("sk-ant-") || ANTHROPIC_API_KEY.startsWith("sk-"));
        // Remove markdown tags if AI returns it wrapped in ```json ... ```
        const cleanJson = (text: string) => text.replace(/```json/g, "").replace(/```/g, "").trim();
        console.log(`Refinement Provider decision: ${isAnthropic ? 'Anthropic' : 'Lovable/Gateway'}. Prefix: ${ANTHROPIC_API_KEY?.substring(0, 7)}`);



        if (isAnthropic) {
          aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY!,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 2048,
              messages: [
                {
                  role: "user",
                  content: `Você é um especialista em extração de dados. Seu objetivo é pegar um texto bruto de um site e transformá-lo em uma descrição clara e organizada dos produtos, serviços, preços e políticas da empresa. Ignore menus de navegação, botões de login e textos genéricos de sistema. Responda APENAS com o conteúdo extraído e organizado. No início da resposta, coloque 'TITULO: [Nome da Loja]'.\n\nURL: ${formattedUrl}\n\nTexto Bruto:\n${text.substring(0, 7000)}`
                }
              ],
            }),
          });
        } else {
          aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [
                {
                  role: "system",
                  content: "Você é um especialista em extração de dados. Seu objetivo é pegar um texto bruto de um site e transformá-lo em uma descrição clara e organizada dos produtos, serviços, preços e políticas da empresa. Ignore menus de navegação, botões de login e textos genéricos de sistema. Responda APENAS com o conteúdo extraído e organizado. No início da resposta, coloque 'TITULO: [Nome da Loja]'."
                },
                {
                  role: "user",
                  content: `Extraia as informações principais deste site:\n\nURL: ${formattedUrl}\n\nTexto Bruto:\n${text.substring(0, 7000)}`
                }
              ],
              model: "gpt-4o-mini"
            }),
          });
        }

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiText = isAnthropic ? cleanJson(aiData.content[0].text) : cleanJson(aiData.choices[0].message.content);
          
          if (aiText && aiText.length > 50) {
            const titleMatch = aiText.match(/TITULO:\s*(.*)/i);
            if (titleMatch) {
              finalTitle = titleMatch[1].trim();
              finalContent = aiText.replace(/TITULO:.*\n?/, "").trim();
            } else {
              finalContent = aiText;
            }
            console.log("AI refinement successful");
          }
        }
      } catch (aiErr) {
        console.error("AI refinement error:", aiErr);
      }
    }


    return new Response(
      JSON.stringify({ title: finalTitle, content: finalContent, url: formattedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao processar URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});