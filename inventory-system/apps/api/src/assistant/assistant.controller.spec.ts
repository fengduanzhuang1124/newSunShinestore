import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { AssistantController } from './assistant.controller.js';

describe('AssistantController (REQ-015)', () => {
  const request = { inventoryUser: { id: 1n, organizationId: 2n, username: 'staff' } };

  it('asks for a reply for the selected store with the trimmed question', async () => {
    const assistant = { reply: jest.fn().mockResolvedValue({ replyId: '9', reply: '有货哦～' } as never) };
    const controller = new AssistantController(assistant as never);
    await expect(controller.reply(request as never, '3', { question: '  有货吗 ' })).resolves.toEqual({
      code: 200, message: '建议回复已生成', data: { replyId: '9', reply: '有货哦～' },
    });
    expect(assistant.reply).toHaveBeenCalledWith(2n, 1n, 3n, '有货吗', null);
    await controller.reply(request as never, '3', { question: '有货吗', productId: '1609' });
    expect(assistant.reply).toHaveBeenLastCalledWith(2n, 1n, 3n, '有货吗', 1609n);
  });

  it('rejects a missing store or a malformed id before reaching the service', async () => {
    const assistant = { reply: jest.fn(), feedback: jest.fn(), updateMailMilk: jest.fn() };
    const controller = new AssistantController(assistant as never);
    await expect(controller.reply(request as never, undefined, { question: '有货吗' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.feedback(request as never, 'abc', '3', { outcome: 'ADOPTED' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.updateMailMilk(request as never, '1;drop', '3', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(assistant.reply).not.toHaveBeenCalled();
    expect(assistant.feedback).not.toHaveBeenCalled();
  });

  it('records feedback against the reply in the store', async () => {
    const assistant = { feedback: jest.fn().mockResolvedValue({ replyId: '9', outcome: 'EDITED' } as never) };
    const controller = new AssistantController(assistant as never);
    await controller.feedback(request as never, '9', '3', { outcome: 'EDITED', editedReply: '有货哦～' });
    expect(assistant.feedback).toHaveBeenCalledWith(2n, 1n, 3n, 9n, { outcome: 'EDITED', editedReply: '有货哦～' });
  });
});
