import { sendTemplateMessage } from '../services/whatsapp'

describe('sendTemplateMessage', () => {
  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sends an authentication copy-code button using Meta Messages API URL syntax', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messages: [{ id: 'wamid.test' }] }),
    } as Response)

    await sendTemplateMessage({
      toPhone: '9052380325',
      templateName: 'verification_otp_v1',
      languageCode: 'en',
      bodyVariables: ['123456'],
      otpButton: { code: '123456' },
    })

    const request = fetchMock.mock.calls[0][1] as RequestInit
    const payload = JSON.parse(request.body as string)

    expect(payload.template.components).toEqual([
      {
        type: 'body',
        parameters: [{ type: 'text', text: '123456' }],
      },
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [{ type: 'text', text: '123456' }],
      },
    ])
  })

  it('includes Meta error details and trace ID in server-side errors', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        error: {
          message: '(#132018) Template validation error',
          code: 132018,
          error_data: { details: 'Button parameter is invalid.' },
          fbtrace_id: 'trace-123',
        },
      }),
    } as Response)

    await expect(sendTemplateMessage({
      toPhone: '9052380325',
      templateName: 'verification_otp_v1',
      languageCode: 'en',
      bodyVariables: ['123456'],
      otpButton: { code: '123456' },
    })).rejects.toThrow(
      '[whatsapp] send failed (132018): Button parameter is invalid. [fbtrace_id: trace-123]',
    )
  })
})
