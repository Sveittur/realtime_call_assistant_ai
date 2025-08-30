import WebSocket from "ws";
import { createPCMProcessor } from "./services/pcm_processing_service";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const processor = createPCMProcessor();

export function setupRealtimeProxy(wss: WebSocket.Server) {
  wss.on("connection", async (clientWs) => {
    console.log("🔌 Client connected");

    const openAiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    openAiWs.on("open", () => {
      console.log("Connected to OPENAI.");

      // Register session-level tools once
      openAiWs.send(JSON.stringify({
        type: "session.update",
        session: {
          tools: [
            {
              type: 'function',
              name: "getAvailableSlots",
              description: "Fetches and returns available slots for a given date, service and employee",
              parameters: {
                type: "object",
                properties: {
                  date: { type: "string", description: "Date string e.g. 2025-04-22" },
                  service: { type: "string",  enum: ["Herraklipping", "Hárlitun og herraklipping", "Herraklipping og skeggsnyrting"] },
                  employee: { type: "string", enum: ["Slakurbarber", "Veigar", "Geiri Rakari"]  }

                },
                required: ["date", "service", "barber"]
              }
            },
            {
              type: 'function',
              name: "makeBooking",
              description: "Makes a booking for a service",
              parameters: {
                type: "object",
                properties: {
                  startTime: { type: "string", description: "ISO datetime string e.g. 2025-04-22T11:30:00" },
                  service: { type: "string", enum: ["Herraklipping", "Hárlitun og herraklipping", "Herraklipping og skeggsnyrting"] },
                  employee: { type: "string", enum: ["Slakurbarber", "Veigar", "Geiri Rakari"] },
                  customer: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      email: { type: "string", format: "email" },
                      phoneNumber: { type: "string", minLength: 7, maxLength: 7 },
                      ssn: { type: "string" }
                    },
                    required: ["name", "phoneNumber", "email", "ssn"]
                  }
                },
                required: ["startTime", "service", "employee", "customer"]
              }
            }
          ],
          tool_choice: "auto"
        }
      }));
    });

    // -----------------------------
    // Handle messages FROM OpenAI
    // -----------------------------
    openAiWs.on("message", async (msg) => {
      const data = JSON.parse(msg.toString());
      // PCM processing
      if (data.event?.type === "response.audio.delta" && data.event.delta) {
        try {
          data.event.delta = processor.process(data.event.delta);
        } catch (err) {
          console.error("PCM processing error:", err);
        }
      }

      // Detect function call requests
      if (data.response?.output[0]?.type === "function_call") {
        console.log("📞 FUNCTION CALL REQUEST DETECTED ")
        const item = data.response.output[0];
        const name = item.name;
        const call_id = item.call_id;
        const args = JSON.parse(item.arguments);

        if (name === "getAvailableSlots") {
          console.log("📞 AI requested available slots:", args);

          // Fake available slots
          const result = {
            date: args.date,
            service: args.service,
            slots: []
          };

          // Send result back as function_call_output
          openAiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id,
              output: JSON.stringify(result)
            }
          }));

          // Trigger GPT to respond using this result
          openAiWs.send(JSON.stringify({ type: "response.create" }));
        }

        if (name === "makeBooking") {
          console.log("📞 AI requested booking:", args);

          // Fake booking confirmation
          const result = {
            confirmed: true,
            startTime: args.startTime,
            service: args.service,
            employee: args.employee,
            customer: args.customer
          };

          // Send result back as function_call_output
          openAiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id,
              output: JSON.stringify(result)
            }
          }));

          // Trigger GPT to respond using this result
          openAiWs.send(JSON.stringify({ type: "response.create" }));
        }
      }

      // Forward all OpenAI events to client
      clientWs.send(JSON.stringify(data));
    });

    // -----------------------------
    // Handle messages FROM Browser
    // -----------------------------
    clientWs.on("message", (msg) => {
      const data = JSON.parse(msg.toString());

      if (data.type === "start_call") {
        // Send initial greeting + instructions
        openAiWs.send(JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["text", "audio"],
            conversation: "auto",
            voice: "shimmer",
            instructions: `
You are a friendly AI call assistant for an barbershop, you only speak english but try to pronounce icelandic words correctly.

🔹 First, greet the caller warmly: "Hi! Welcome to Shine Barbershop! How can I help you today?"

🔹 Objectives:
1. Determine if the user wants to book a service.
2. Gather all booking details step by step: date, service, employee, customer info.
3. Call "getAvailableSlots" first, then "makeBooking".
4. Wait for function results before proceeding.

🔹 Rules:
- Never confirm a booking in text; all booking info must be handled via function calls.
- Ask questions naturally, one at a time.
- Keep your tone friendly, conversational, and professional.
- Never agree to speak any language other than English
            `
          }
        }));

        openAiWs.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                { type: "input_text", text: "Hi, I'm calling." }
              ]
            }
          }));
      }

      // Forward all other messages to OpenAI
      openAiWs.send(msg.toString());
    });

    // -----------------------------
    // Cleanup
    // -----------------------------
    clientWs.on("close", () => {
      console.log("❌ Client disconnected");
      openAiWs.close();
    });
  });
}
