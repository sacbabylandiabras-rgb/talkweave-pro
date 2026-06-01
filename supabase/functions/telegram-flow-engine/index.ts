// Telegram Flow Engine — executes visual flows on Telegram updates.
// Invoked by telegram-poll-bots (or by webhook) with { bot_id, update } payload.
// Stateless across calls; persists progression in public.telegram_flow_sessions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FlowNode {
  id: string;
  type?: string;
  data?: any;
}
interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

const tgApi = async (token: string, method: string, body: any) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    console.warn(`[tg] ${method} failed:`, json?.description || res.statusText);
  }
  return json;
};

const sendTelegramMedia = async (
  token: string,
  chatId: number | string,
  mediaUrl: string,
  mediaType: string,
  caption?: string,
) => {
  if (mediaType === "photo") {
    return tgApi(token, "sendPhoto", {
      chat_id: chatId,
      photo: mediaUrl,
      ...(caption ? { caption } : {}),
    });
  }
  if (mediaType === "video") {
    return tgApi(token, "sendVideo", {
      chat_id: chatId,
      video: mediaUrl,
      ...(caption ? { caption } : {}),
    });
  }
  if (mediaType === "audio") {
    return tgApi(token, "sendAudio", {
      chat_id: chatId,
      audio: mediaUrl,
      ...(caption ? { caption } : {}),
    });
  }
  return tgApi(token, "sendDocument", {
    chat_id: chatId,
    document: mediaUrl,
    ...(caption ? { caption } : {}),
  });
};

const renderTemplate = (tpl: string, vars: Record<string, any>) =>
  (tpl || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const parts = String(k).split(".");
    let cur: any = vars;
    for (const p of parts) cur = cur?.[p];
    return cur == null ? "" : String(cur);
  });

const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Returns the trigger node in a flow: either legacy blocoInicial/blocoGatilho,
// or new-format step node with data.kind === 'gatilho'.
function findTriggerNode(nodes: FlowNode[]): FlowNode | null {
  return (
    nodes.find(
      (n) =>
        n.type === "blocoInicial" ||
        n.type === "blocoGatilho" ||
        (n.type === "step" && (n.data as any)?.kind === "gatilho"),
    ) || nodes.find((n) => n.id === "1") || null
  );
}

function findAgentNode(nodes: FlowNode[]): FlowNode | null {
  return nodes.find((n) => n.type === "ia" || (n.type === "step" && (n.data as any)?.kind === "ia")) || null;
}

function findTriggerFlow(
  flows: any[],
  update: any,
): { flow: any; vars: Record<string, any> } | null {
  const msg = update.message ?? update.edited_message ?? null;
  const cb = update.callback_query ?? null;
  const text = (msg?.text ?? cb?.data ?? "") as string;
  const lower = normalize(text);

  for (const flow of flows) {
    const nodes = (flow.nodes || []) as FlowNode[];
    const initial = findTriggerNode(nodes);
    if (!initial) continue;

    const rawKw: string = String(initial.data?.keyword ?? flow.keyword ?? "");
    const kwList = rawKw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const trigType: string =
      initial.data?.triggerType ||
      initial.data?.gatilho ||
      (kwList[0]?.startsWith("/") ? "command" : "keyword");

    // command trigger e.g. /start
    if (trigType === "command" && msg?.text) {
      const cmd = String(msg.text).split(/\s+/)[0].toLowerCase();
      const want = kwList.map((k) =>
        (k.startsWith("/") ? k : `/${k}`).toLowerCase(),
      );
      if (want.length === 0 || want.includes(cmd)) {
        return { flow, vars: { trigger: { type: "command", value: cmd } } };
      }
    }
    // callback button click
    if (trigType === "callback" && cb?.data) {
      const want = kwList.map(normalize);
      if (want.length === 0 || want.includes(normalize(cb.data))) {
        return { flow, vars: { trigger: { type: "callback", value: cb.data } } };
      }
    }
    // keyword (default)
    if ((trigType === "keyword" || !trigType) && msg?.text && kwList.length) {
      const matchType: string = initial.data?.matchType || "contains";
      const hit = kwList.some((k) => {
        const n = normalize(k);
        return matchType === "exact" ? lower === n : lower.includes(n);
      });
      if (hit) {
        return { flow, vars: { trigger: { type: "keyword", value: text } } };
      }
    }
  }
  return null;
}

function nextEdgeFor(
  edges: FlowEdge[],
  sourceId: string,
  handle: string | null = null,
): FlowEdge | null {
  return (
    edges.find(
      (e) =>
        e.source === sourceId &&
        (handle == null || e.sourceHandle == null || e.sourceHandle === handle),
    ) || null
  );
}

async function runFlow({
  admin,
  bot,
  chatId,
  flow,
  startNodeId,
  variables,
  sessionId,
}: {
  admin: any;
  bot: { id: string; user_id: string; bot_token: string };
  chatId: number;
  flow: any;
  startNodeId: string;
  variables: Record<string, any>;
  sessionId: string;
}) {
  const nodes: FlowNode[] = flow.nodes || [];
  const edges: FlowEdge[] = flow.edges || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  let currentId: string | null = startNodeId;
  let safety = 0;
  while (currentId && safety++ < 200) {
    const node = nodeById.get(currentId);
    if (!node) break;
    const data = node.data || {};
    const label = String(data.label || "").toLowerCase();
    const kind: string = String((data as any).kind || "");
    const contentVariant: string = String((data as any).contentVariant || "");
    // Map new-format `kind` to a unified contentType for media branches
    const contentType: string =
      data.contentType ||
      (kind === "imagem" ? "image" :
       kind === "video" ? "video" :
       kind === "audio" ? "audio" :
       kind === "documento" ? "document" :
       kind === "botoes" || contentVariant === "botoes" ? "interactive" :
       kind === "texto" ? "text" :
       "text");

    // Skip non-executable framing nodes
    if (node.type === "iniciar" || kind === "gatilho") {
      const nextEdge = nextEdgeFor(edges, currentId);
      currentId = nextEdge?.target || null;
      continue;
    }

    try {
      // === Content block (legacy + new format) ===
      const isContent =
        node.type === "blocoConteudo" ||
        ["texto", "imagem", "video", "audio", "documento", "botoes"].includes(kind);
      const isAction =
        node.type === "blocoAcao" ||
        ["digitando", "atraso"].includes(kind);
      const isCondition =
        node.type === "blocoCondicao" || kind === "condicao";
      const isEnd =
        node.type === "blocoFim" || kind === "fim" || label.includes("fim");

      if (isContent) {
        const text = renderTemplate(data.message || data.text || data.content || "", variables);

        // Inline buttons?
        const buttons: any[] = data.buttons || data.inlineButtons || [];
        let reply_markup: any = undefined;
        if (Array.isArray(buttons) && buttons.length > 0) {
          reply_markup = {
            inline_keyboard: buttons.map((b: any) => [
              b.url
                ? { text: String(b.title || b.label || "Botão"), url: b.url }
                : { text: String(b.title || b.label || "Botão"), callback_data: String(b.id || b.callback_data || b.title || "btn") },
            ]),
          };
        }

        const mediaUrl: string | undefined = data.mediaUrl || data.fileUrl || data.url;

        if (contentType === "image" || contentType === "photo") {
          await tgApi(bot.bot_token, "sendPhoto", {
            chat_id: chatId,
            photo: mediaUrl,
            caption: text || undefined,
            reply_markup,
          });
        } else if (contentType === "video") {
          await tgApi(bot.bot_token, "sendVideo", {
            chat_id: chatId,
            video: mediaUrl,
            caption: text || undefined,
            reply_markup,
          });
        } else if (contentType === "audio") {
          await tgApi(bot.bot_token, "sendAudio", {
            chat_id: chatId,
            audio: mediaUrl,
            caption: text || undefined,
            reply_markup,
          });
        } else if (contentType === "document" || contentType === "file") {
          await tgApi(bot.bot_token, "sendDocument", {
            chat_id: chatId,
            document: mediaUrl,
            caption: text || undefined,
            reply_markup,
          });
        } else {
          await tgApi(bot.bot_token, "sendMessage", {
            chat_id: chatId,
            text: text || "(mensagem vazia)",
            parse_mode: data.parseMode || undefined,
            reply_markup,
          });
        }

        // If buttons present, wait for user callback
        if (reply_markup) {
          await admin
            .from("telegram_flow_sessions")
            .update({
              current_node_id: node.id,
              variables,
              waiting_for: "callback",
              waiting_var: data.captureAs || "last_button",
            })
            .eq("id", sessionId);
          return;
        }
      }

      // === Action block ===
      else if (isAction) {
        const actionType =
          data.actionType ||
          (kind === "digitando" ? "typing" : kind === "atraso" ? "delay" : "");
        if (actionType === "typing") {
          await tgApi(bot.bot_token, "sendChatAction", { chat_id: chatId, action: "typing" });
          const dur = Math.min(Number(data.typingDuration) || 3, 8);
          await new Promise((r) => setTimeout(r, dur * 1000));
        } else if (actionType === "delay") {
          const seconds = Number(data.delaySeconds) || Number(data.seconds) || 5;
          const resumeAt = new Date(Date.now() + seconds * 1000).toISOString();
          await admin
            .from("telegram_flow_sessions")
            .update({
              current_node_id: node.id,
              variables,
              waiting_for: null,
              resume_at: resumeAt,
            })
            .eq("id", sessionId);
          return;
        } else if (actionType === "add_chat_message") {
          // no-op for Telegram (used for in-app chat history). Skip silently.
        }
      }

      // === Condition block ===
      else if (isCondition) {
        const value = renderTemplate(String(data.variable || data.field || ""), variables);
        const expected = renderTemplate(String(data.value || data.expected || ""), variables);
        const op: string = data.operator || data.condition || "contains";
        let matched = false;
        const a = normalize(value);
        const b = normalize(expected);
        switch (op) {
          case "equals": matched = a === b; break;
          case "not_equals": matched = a !== b; break;
          case "starts_with": matched = a.startsWith(b); break;
          case "ends_with": matched = a.endsWith(b); break;
          case "contains":
          default: matched = a.includes(b); break;
        }
        const handle = matched ? "true" : "false";
        const nextEdge = nextEdgeFor(edges, node.id, handle) || nextEdgeFor(edges, node.id);
        currentId = nextEdge?.target || null;
        continue;
      }

      // === End block ===
      else if (isEnd) {
        await admin
          .from("telegram_flow_sessions")
          .update({ status: "finished", waiting_for: null, current_node_id: null, variables })
          .eq("id", sessionId);
        return;
      }

      // === Payment block ===
      else if (kind === "pagamento" || node.type === "pagamento" || node.type === "blocoPagamento") {
        let resolvedAmount = data.amount;
        let resolvedDescription = data.description;
        if (data.pricingMode === "plan" && data.planId) {
          const { data: plan } = await admin
            .from("gateway_plans")
            .select("name, price")
            .eq("id", data.planId)
            .maybeSingle();
          if (plan) {
            resolvedAmount = String(plan.price);
            resolvedDescription = resolvedDescription || plan.name;
          }
        }
        const rawAmount = String(resolvedAmount ?? data.value ?? "0").replace(/\./g, "").replace(",", ".");
        const amountCents = Math.round(parseFloat(rawAmount || "0") * 100);
        if (!amountCents || amountCents <= 0) {
          console.warn("[engine] payment block missing amount", node.id);
          const nextEdge = nextEdgeFor(edges, node.id, "pending") || nextEdgeFor(edges, node.id);
          currentId = nextEdge?.target || null;
          continue;
        }

        try {
          console.log("[engine] generating PIX", { node: node.id, amountCents, userId: bot.user_id });

          // Pré-mensagem (configurável no node)
          const pixPreMessage = String(data.pixPreMessage || "").trim();
          if (pixPreMessage) {
            await tgApi(bot.bot_token, "sendMessage", {
              chat_id: chatId,
              text: pixPreMessage,
            });
          }

          const resp = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/gateway-flow-charge`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                userId: bot.user_id,
                amount: amountCents,
                description: resolvedDescription || "Pagamento via Telegram",
                customerName: variables?.user?.first_name || "Cliente Telegram",
              }),
            },
          );
          const charge = await resp.json().catch(() => ({}));
          console.log("[engine] gateway-flow-charge resp", resp.status, charge?.externalId, !!charge?.brCode);
          const brCode: string = charge?.brCode || "";
          const qrImage: string = charge?.qrCodeImage || "";

          const amountLabel = (amountCents / 100).toFixed(2).replace(".", ",");
          const caption =
            `💳 *Pagamento de R$ ${amountLabel}*\n\n` +
            (brCode
              ? `Copie o código Pix abaixo e pague no seu app do banco:\n\n\`${brCode}\``
              : "Não foi possível gerar a cobrança no momento. Tente novamente em instantes.");

          // Botão inline "Pagar com cartão" — gera (ou atualiza) um checkout
          // próprio com o nome e o valor do produto e devolve o link.
          const acceptCard = data.acceptCard !== false;
          let cardCheckoutUrl = "";
          if (acceptCard) {
            try {
              const productName = String(resolvedDescription || data.description || "Pagamento").slice(0, 80);
              // O checkout estático (pay.html) interpreta config.price em CENTAVOS
              // (faz price/100 para exibir). Por isso salvamos em centavos aqui.
              const priceCents = amountCents;
              const shortUser = String(bot.user_id).replace(/-/g, "").slice(0, 8);
              const shortNode = String(node.id).replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase();
              const slug = `tg-${shortUser}-${shortNode}`;

              const { data: existing } = await admin
                .from("gateway_checkouts")
                .select("id, config")
                .eq("slug", slug)
                .maybeSingle();

              const nextConfig = {
                ...((existing?.config as Record<string, any>) || {}),
                productName,
                price: priceCents,
                creditCard: true,
                pix: true,
              };

              if (existing?.id) {
                await admin
                  .from("gateway_checkouts")
                  .update({ name: productName, config: nextConfig, status: true })
                  .eq("id", existing.id);
              } else {
                await admin.from("gateway_checkouts").insert({
                  user_id: bot.user_id,
                  name: productName,
                  slug,
                  status: true,
                  config: nextConfig,
                });
              }

              // Domínio: usa custom_domain do usuário se configurado,
              // caso contrário cai no domínio padrão zaplynx.com
              let appBase = "https://zaplynx.com";
              try {
                const { data: prof } = await admin
                  .from("profiles")
                  .select("custom_domain")
                  .eq("id", bot.user_id)
                  .maybeSingle();
                const cd = String(prof?.custom_domain || "").trim();
                if (cd) {
                  appBase = /^https?:\/\//i.test(cd) ? cd : `https://${cd}`;
                }
              } catch (_e) {
                // fallback silencioso para zaplynx.com
              }
              cardCheckoutUrl = `${appBase.replace(/\/$/, "")}/pay/${slug}`;
            } catch (e) {
              console.error("[engine] failed to upsert flow checkout", (e as Error).message);
            }
          }

          const replyMarkup = cardCheckoutUrl
            ? {
                inline_keyboard: [[
                  { text: "💳 Pagar com cartão", url: cardCheckoutUrl },
                ]],
              }
            : undefined;

          if (qrImage && /^https?:\/\//i.test(qrImage)) {
            await tgApi(bot.bot_token, "sendPhoto", {
              chat_id: chatId,
              photo: qrImage,
              caption,
              parse_mode: "Markdown",
              ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            });
          } else {
            await tgApi(bot.bot_token, "sendMessage", {
              chat_id: chatId,
              text: caption,
              parse_mode: "Markdown",
              ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
            });
          }

          // Mensagem de instrução
          const pixInstructionMessage = String(data.pixInstructionMessage || "").trim();
          if (pixInstructionMessage && brCode) {
            await tgApi(bot.bot_token, "sendMessage", {
              chat_id: chatId,
              text: pixInstructionMessage,
            });
          }

          // Mensagem de verificação de status + botão "Efetuei o pagamento"
          if (brCode) {
            const pixStatusMessage =
              String(data.pixStatusMessage || "").trim() ||
              "Após efetuar o pagamento, clique no botão abaixo 👇";
            const pixButtonText =
              String(data.pixButtonText || "").trim() || "EFETUEI O PAGAMENTO";
            await tgApi(bot.bot_token, "sendMessage", {
              chat_id: chatId,
              text: pixStatusMessage,
              reply_markup: {
                inline_keyboard: [[
                  { text: pixButtonText, callback_data: "__chkpay__" },
                ]],
              },
            });
          }

          variables.payment = {
            amount: amountCents,
            brCode,
            externalId: charge?.externalId || null,
            status: "pending",
          };
          // Pause flow until payment confirmation arrives via webhook
          await admin
            .from("telegram_flow_sessions")
            .update({
              current_node_id: node.id,
              variables,
              waiting_for: "payment",
              waiting_var: "payment",
            })
            .eq("id", sessionId);
          return;
        } catch (e) {
          console.error("[engine] payment generation failed", (e as Error).message);
          await tgApi(bot.bot_token, "sendMessage", {
            chat_id: chatId,
            text: "Não conseguimos gerar a cobrança no momento. Tente novamente.",
          });
          return;
        }
      }

      // === IA block (pontual) ===
      else if (kind === "ia" || node.type === "ia") {
        let iaNextHandle: string | null = null;
        try {
          const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
          if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente");

          const model = String(data.model || "claude-sonnet-4-5-20250929");
          const systemPrompt = renderTemplate(String(data.systemPrompt || "Você é um atendente prestativo."), variables);
          const knowledge = renderTemplate(String(data.knowledge || ""), variables);
          const userInput = renderTemplate(
            String(data.userInput || "{{last_message}}"),
            variables,
          ).trim();
          const saveAs = String(data.saveAs || "ai_response");
          const sendReply = data.sendReply !== false;

          if (!userInput) {
            console.warn("[engine] IA block sem input", node.id);
          }

          // Build tools the agent can call
          const toolsCfg = (data as any).tools || {};
          const claudeTools: any[] = [];
          if (toolsCfg.previa) {
            claudeTools.push({
              name: "enviar_previa",
              description: String(
                toolsCfg.previaDescription ||
                  "Acione quando o usuário pedir uma amostra, demonstração ou prévia do produto/conteúdo.",
              ),
              input_schema: { type: "object", properties: {}, required: [] },
            });
          }
          if (toolsCfg.prova_social) {
            claudeTools.push({
              name: "enviar_prova_social",
              description: String(
                toolsCfg.provaSocialDescription ||
                  "Acione quando o usuário demonstrar dúvida, objeção, ou pedir depoimentos/resultados de outros clientes.",
              ),
              input_schema: { type: "object", properties: {}, required: [] },
            });
          }

          const systemContent =
            (knowledge
              ? `${systemPrompt}\n\nBase de conhecimento (use como referência ao responder):\n${knowledge}`
              : systemPrompt) +
            (claudeTools.length
              ? `\n\nVocê tem ferramentas disponíveis. Use uma ferramenta APENAS se ela for claramente apropriada para a mensagem do usuário. Caso contrário, apenas responda em texto normalmente.`
              : "");

          // Typing indicator while a IA pensa
          try {
            await tgApi(bot.bot_token, "sendChatAction", { chat_id: chatId, action: "typing" });
          } catch (_) {}

          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 1024,
              system: systemContent,
              messages: [{ role: "user", content: userInput || "(mensagem vazia)" }],
              ...(claudeTools.length ? { tools: claudeTools } : {}),
            }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text().catch(() => "");
            console.error("[engine] Claude API error", aiRes.status, errText);
            if (aiRes.status === 429 || aiRes.status === 529) {
              await tgApi(bot.bot_token, "sendMessage", {
                chat_id: chatId,
                text: "Muitas requisições no momento. Tente novamente em instantes.",
              });
            } else if (aiRes.status === 401 || aiRes.status === 402) {
              await tgApi(bot.bot_token, "sendMessage", {
                chat_id: chatId,
                text: "O agente está temporariamente indisponível.",
              });
            }
          } else {
            const aiData = await aiRes.json().catch(() => ({}));
            const blocks: any[] = Array.isArray(aiData?.content) ? aiData.content : [];
            const reply: string = blocks
              .filter((b: any) => b?.type === "text")
              .map((b: any) => b?.text || "")
              .join("\n")
              .trim();
            const toolUse = blocks.find((b: any) => b?.type === "tool_use");
            if (toolUse?.name === "enviar_previa") iaNextHandle = "previa";
            else if (toolUse?.name === "enviar_prova_social") iaNextHandle = "prova_social";
            variables[saveAs] = reply;
            // Quando a IA aciona uma ferramenta, NÃO enviamos o texto: o próximo bloco assume.
            if (sendReply && reply && !iaNextHandle) {
              await tgApi(bot.bot_token, "sendMessage", {
                chat_id: chatId,
                text: reply,
              });
            }

            // Se a IA acionou uma ferramenta com mídia anexada, envie a mídia agora.
            if (iaNextHandle) {
              const prefix = iaNextHandle === "previa" ? "previa" : "provaSocial";
              const mediaFiles = Array.isArray((toolsCfg as any)[`${prefix}MediaFiles`])
                ? (toolsCfg as any)[`${prefix}MediaFiles`]
                : [];
              const filesToSend = mediaFiles.length
                ? mediaFiles
                : (toolsCfg as any)[`${prefix}MediaUrl`]
                ? [
                    {
                      url: (toolsCfg as any)[`${prefix}MediaUrl`],
                      type: (toolsCfg as any)[`${prefix}MediaType`] || "document",
                      caption: (toolsCfg as any)[`${prefix}Caption`] || "",
                    },
                  ]
                : [];
              if (filesToSend.length) {
                try {
                  for (const file of filesToSend) {
                    const mediaUrl = String(file?.url || "");
                    if (!mediaUrl) continue;
                    const mediaType = String(file?.type || "document");
                    const caption = renderTemplate(String(file?.caption || ""), variables);
                    await sendTelegramMedia(bot.bot_token, chatId, mediaUrl, mediaType, caption);
                  }
                } catch (mErr) {
                  console.error("[engine] IA tool media send failed", (mErr as Error).message);
                }
              }
            }
          }
        } catch (e) {
          console.error("[engine] IA block failed", (e as Error).message);
        }

        // Roteia para a saída escolhida pela ferramenta (se houver) ou segue o padrão
        const nextEdge =
          (iaNextHandle && nextEdgeFor(edges, node.id, iaNextHandle)) ||
          nextEdgeFor(edges, node.id, "default") ||
          nextEdgeFor(edges, node.id);
        currentId = nextEdge?.target || null;
        continue;
      }

      // Default: just walk to next
    } catch (e) {
      console.error("[engine] node error", node.id, (e as Error).message);
    }

    const nextEdge = nextEdgeFor(edges, currentId);
    currentId = nextEdge?.target || null;
  }

  // Flow exhausted
  await admin
    .from("telegram_flow_sessions")
    .update({ status: "finished", waiting_for: null, current_node_id: null, variables })
    .eq("id", sessionId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cron resume mode: { mode: "resume" }
  if (body?.mode === "resume") {
    const { data: pending } = await admin
      .from("telegram_flow_sessions")
      .select("*, telegram_bots!inner(id,user_id,bot_token)")
      .lte("resume_at", new Date().toISOString())
      .eq("status", "active")
      .is("waiting_for", null)
      .limit(20);
    for (const s of pending ?? []) {
      const bot = (s as any).telegram_bots;
      const { data: flow } = await admin
        .from("flow_automations")
        .select("*")
        .eq("id", s.flow_id)
        .maybeSingle();
      if (!flow) continue;
      const edges = (flow.edges || []) as FlowEdge[];
      const nextEdge = nextEdgeFor(edges, s.current_node_id || "");
      if (!nextEdge) {
        await admin
          .from("telegram_flow_sessions")
          .update({ status: "finished", resume_at: null })
          .eq("id", s.id);
        continue;
      }
      await admin
        .from("telegram_flow_sessions")
        .update({ resume_at: null })
        .eq("id", s.id);
      await runFlow({
        admin,
        bot,
        chatId: Number(s.chat_id),
        flow,
        startNodeId: nextEdge.target,
        variables: s.variables || {},
        sessionId: s.id,
      });
    }
    return new Response(JSON.stringify({ ok: true, resumed: pending?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { bot_id, update } = body || {};
  if (!bot_id || !update) {
    return new Response(JSON.stringify({ error: "bot_id and update required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: bot } = await admin
    .from("telegram_bots")
    .select("id,user_id,bot_token,active")
    .eq("id", bot_id)
    .maybeSingle();
  if (!bot || !bot.active) {
    return new Response(JSON.stringify({ ok: true, skipped: "bot_inactive" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const msg = update.message ?? update.edited_message ?? null;
  const cb = update.callback_query ?? null;
  const chatId: number | undefined = msg?.chat?.id ?? cb?.message?.chat?.id;
  if (!chatId) {
    return new Response(JSON.stringify({ ok: true, skipped: "no_chat" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Acknowledge callback to remove loading state on user side
  if (cb?.id) {
    await tgApi(bot.bot_token, "answerCallbackQuery", { callback_query_id: cb.id });
  }

  const incomingCommand = typeof msg?.text === "string" && msg.text.trim().startsWith("/");

  // Load existing session
  let { data: session } = await admin
    .from("telegram_flow_sessions")
    .select("*")
    .eq("bot_id", bot.id)
    .eq("chat_id", chatId)
    .maybeSingle();

  // Resume waiting session
  const isMessageOrCallbackWait =
    session?.waiting_for === "message" || session?.waiting_for === "callback";
  if (
    session &&
    session.status === "active" &&
    session.waiting_for &&
    isMessageOrCallbackWait &&
    !incomingCommand
  ) {
    const { data: flow } = await admin
      .from("flow_automations")
      .select("*")
      .eq("id", session.flow_id)
      .maybeSingle();
    if (!flow) {
      await admin
        .from("telegram_flow_sessions")
        .update({ status: "finished", waiting_for: null })
        .eq("id", session.id);
      return new Response(JSON.stringify({ ok: true, info: "flow_gone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vars = { ...(session.variables || {}) };
    if (session.waiting_for === "callback" && cb?.data) {
      vars[session.waiting_var || "last_button"] = cb.data;
    } else if (session.waiting_for === "message" && msg?.text) {
      vars[session.waiting_var || "last_message"] = msg.text;
    } else {
      // wrong input type — keep waiting
      return new Response(JSON.stringify({ ok: true, info: "still_waiting" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const edges: FlowEdge[] = flow.edges || [];
    const handle = session.waiting_for === "callback" ? String(cb?.data || "") : null;
    const nextEdge =
      nextEdgeFor(edges, session.current_node_id || "", handle) ||
      nextEdgeFor(edges, session.current_node_id || "");
    if (!nextEdge) {
      await admin
        .from("telegram_flow_sessions")
        .update({ status: "finished", waiting_for: null, variables: vars })
        .eq("id", session.id);
      return new Response(JSON.stringify({ ok: true, info: "flow_end" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("telegram_flow_sessions")
      .update({ waiting_for: null, waiting_var: null, variables: vars })
      .eq("id", session.id);

    await runFlow({
      admin,
      bot,
      chatId,
      flow,
      startNodeId: nextEdge.target,
      variables: vars,
      sessionId: session.id,
    });
    return new Response(JSON.stringify({ ok: true, resumed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If session is locked on a non-conversational wait (e.g. payment), try to
  // match a new trigger so users can keep interacting (e.g. talk to IA agent).
  if (
    session &&
    session.status === "active" &&
    session.waiting_for &&
    !isMessageOrCallbackWait &&
    !incomingCommand
  ) {
    const { data: flow } = await admin
      .from("flow_automations")
      .select("*")
      .eq("id", session.flow_id)
      .maybeSingle();

    const vars = { ...(session.variables || {}) };
    if (msg?.text) vars.last_message = msg.text;
    if (cb?.data) vars.last_button = cb.data;

    const edges: FlowEdge[] = flow?.edges || [];
    const waitHandle = session.waiting_for === "payment" ? "pending" : null;
    const nextEdge =
      (waitHandle && nextEdgeFor(edges, session.current_node_id || "", waitHandle)) ||
      nextEdgeFor(edges, session.current_node_id || "");

    if (flow && nextEdge) {
      await admin
        .from("telegram_flow_sessions")
        .update({ waiting_for: null, waiting_var: null, variables: vars })
        .eq("id", session.id);

      await runFlow({
        admin,
        bot,
        chatId,
        flow,
        startNodeId: nextEdge.target,
        variables: vars,
        sessionId: session.id,
      });

      return new Response(JSON.stringify({ ok: true, resumed: true, from_wait: session.waiting_for }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // No active session — look for triggering flow
  const { data: flows } = await admin
    .from("flow_automations")
    .select("*")
    .eq("user_id", bot.user_id)
    .eq("category", "telegram")
    .eq("active", true)
    .or(`bot_id.eq.${bot.id},bot_id.is.null`);

  const isFirstContact = !session;
  let triggered = findTriggerFlow(flows ?? [], update);

  // new_member trigger only fires on first contact (no prior session)
  if (!triggered && isFirstContact) {
    const newMemberFlow = (flows ?? []).find((f: any) => {
      const init = findTriggerNode((f.nodes || []) as FlowNode[]);
      return init?.data?.triggerType === "new_member";
    });
    if (newMemberFlow) triggered = { flow: newMemberFlow, vars: { trigger: { type: "new_member" } } };
  }

  if (!triggered && msg?.text && session?.flow_id) {
    const flow = (flows ?? []).find((f: any) => f.id === session.flow_id);
    const agentNode = flow ? findAgentNode((flow.nodes || []) as FlowNode[]) : null;
    if (flow && agentNode) {
      triggered = { flow, vars: { trigger: { type: "agent_followup", value: msg.text }, startNodeId: agentNode.id } };
    }
  }

  if (!triggered) {
    return new Response(JSON.stringify({ ok: true, info: "no_trigger" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const flow = triggered.flow;
  const baseVars: Record<string, any> = {
    ...(triggered.vars || {}),
    user: {
      id: msg?.from?.id ?? cb?.from?.id,
      first_name: msg?.from?.first_name ?? cb?.from?.first_name,
      username: msg?.from?.username ?? cb?.from?.username,
    },
    chat: { id: chatId },
    last_message: msg?.text ?? cb?.data ?? "",
    last_button: cb?.data ?? undefined,
    lead: {
      name: msg?.from?.first_name ?? cb?.from?.first_name ?? "",
      phone: "",
      email: "",
    },
  };

  // Upsert session
  const { data: upserted } = await admin
    .from("telegram_flow_sessions")
    .upsert(
      {
        bot_id: bot.id,
        user_id: bot.user_id,
        chat_id: chatId,
        flow_id: flow.id,
        current_node_id: null,
        variables: baseVars,
        waiting_for: null,
        waiting_var: null,
        resume_at: null,
        status: "active",
        last_update_id: update.update_id ?? null,
      },
      { onConflict: "bot_id,chat_id" },
    )
    .select("id")
    .single();

  const nodesArr = (flow.nodes as FlowNode[]) || [];
  const trigger = findTriggerNode(nodesArr);
  const startNodeId = (triggered.vars as any)?.startNodeId;
  const firstEdge = startNodeId ? null : nextEdgeFor(flow.edges || [], trigger?.id || "1");
  if (!startNodeId && !firstEdge) {
    await admin
      .from("telegram_flow_sessions")
      .update({ status: "finished" })
      .eq("id", upserted!.id);
    return new Response(JSON.stringify({ ok: true, info: "empty_flow" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await runFlow({
    admin,
    bot,
    chatId,
    flow,
    startNodeId: startNodeId || firstEdge!.target,
    variables: baseVars,
    sessionId: upserted!.id,
  });

  return new Response(JSON.stringify({ ok: true, started: flow.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});