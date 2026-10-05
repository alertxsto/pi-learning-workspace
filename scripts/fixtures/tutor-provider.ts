// Isolated smoke fixture ONLY. No network, credentials, real model or production hook.
import fs from 'node:fs';
import path from 'node:path';
import { createAssistantMessageEventStream, getCurrentTools } from '@earendil-works/pi-ai';

export default function (pi: any) {
  pi.registerProvider('learning-smoke', {
    api: 'learning-smoke-api', baseUrl: 'http://unused.invalid', apiKey: 'test-fixture-not-a-credential',
    models: [{ id: 'fixture', name: 'Offline tutor fixture', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 64000, maxTokens: 2000 }],
    streamSimple(model: any, context: any, options: any) {
      const stream = createAssistantMessageEventStream();
      void (async () => {
        const message: any = { role: 'assistant', api: model.api, provider: model.provider, model: model.id, timestamp: Date.now(), stopReason: 'pending', content: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
        try {
          if (getCurrentTools(context.messages).length) throw new Error('Inline tutor unexpectedly has tools');
          const user = context.messages.filter((entry: any) => entry.role === 'user').at(-1);
          const text = typeof user.content === 'string' ? user.content : user.content.filter((part: any) => part.type === 'text').map((part: any) => part.text).join('');
          const packet = JSON.parse(text);
          fs.appendFileSync(path.join(packet.workspace, 'tutor-fixture.jsonl'), JSON.stringify(packet) + '\n');
          await new Promise(resolve => setTimeout(resolve, packet.question === 'slow request' ? 2500 : 150));
          if (options?.signal?.aborted) throw new Error('cancelled');
          const reply = `INLINE_REPLY ${packet.intent}: ${packet.currentStep}. ${packet.evidence?.draft?.text?.includes('UNSAVED_ONLY') ? 'UNSAVED_SEEN' : 'LESSON_KNOWN'}`;
          stream.push({ type: 'start', partial: message });
          message.content.push({ type: 'text', text: '' });
          stream.push({ type: 'text_start', contentIndex: 0, partial: message });
          message.content[0].text = reply;
          stream.push({ type: 'text_delta', contentIndex: 0, delta: reply, partial: message });
          stream.push({ type: 'text_end', contentIndex: 0, content: reply, partial: message });
          message.stopReason = 'stop'; stream.push({ type: 'done', reason: 'stop', message });
        } catch (error: any) {
          message.stopReason = options?.signal?.aborted ? 'aborted' : 'error'; message.errorMessage = error.message;
          stream.push({ type: 'error', reason: message.stopReason, error: message });
        } finally { stream.end(); }
      })();
      return stream;
    },
  });
}
