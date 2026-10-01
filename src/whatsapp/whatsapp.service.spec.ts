import { WhatsappService } from './whatsapp.service';
import { WhatsappMessageType } from './entities/whatsapp-message-log.entity';

describe('Destinatarios de confirmacion de WhatsApp', () => {
  let service: WhatsappService;
  let turno: any;
  let logs: any[];
  let config: Record<string, string>;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    turno = {
      id_turno: 1,
      estado: 'CONFIRMADO',
      fechaHora: new Date('2026-10-02T15:00:00Z'),
      cliente: { nombre: 'Peque', adulto: { telefono: 1123456789 } },
      profesional: { usuario: { nombre: 'Ana', telefono: 2284594159 } },
      servicio: { nombre: 'Corte' },
    };
    logs = [];
    config = {
      WHATSAPP_ENABLED: 'true',
      WHATSAPP_API_TOKEN: 'test-token',
      WHATSAPP_PHONE_NUMBER_ID: 'test-id',
      WHATSAPP_CONFIRMATION_TEMPLATE: 'family_confirmation',
      WHATSAPP_ADMIN_CONFIRMATION_TEMPLATE: 'admin_confirmation',
    };
    service = new WhatsappService(
      { get: (key: string) => config[key] } as any,
      {
        findOne: jest.fn(async ({ where }) => logs.find((log) =>
          Object.entries(where).every(([key, value]) => log[key] === value))),
        create: (log: any) => log,
        save: jest.fn(async (log) => {
          if (!logs.includes(log)) logs.push(log);
          return log;
        }),
      } as any,
      { findOne: jest.fn(async () => turno) } as any,
    );
    fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'test-message' }] }),
    } as Response);
  });

  afterEach(() => jest.restoreAllMocks());

  it('envia la confirmacion familiar al adulto y admin_confirmation solo al profesional, sin duplicados', async () => {
    await service.sendTurnoConfirmation(1);
    await service.sendTurnoConfirmation(1);

    const requests = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));
    expect(requests.map((request) => [request.to, request.template.name])).toEqual([
      ['5491123456789', 'family_confirmation'],
      ['5492284594159', 'admin_confirmation'],
    ]);
    const professionalParameters = requests[1].template.components[0].parameters;
    expect(professionalParameters.map((parameter) => parameter.parameter_name)).toEqual([
      'nino',
      'turno',
      'servicio',
      'profesional',
      'reserva',
    ]);
    expect(JSON.stringify(professionalParameters)).not.toContain('1123456789');
    expect(logs.find((log) => log.messageType === WhatsappMessageType.ADMIN_CONFIRMACION)
      ?.recipientPhone).toBe('5492284594159');
  });

  it.each([null, { usuario: null }, { usuario: { telefono: null } }])(
    'omite el aviso si no hay telefono profesional: %j', async (profesional) => {
      turno.profesional = profesional;
      await service.sendTurnoConfirmation(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(logs[0].messageType).toBe(WhatsappMessageType.CONFIRMACION);
    },
  );

  it('no envia avisos para turnos cancelados', async () => {
    turno.estado = 'CANCELADO';
    await service.sendTurnoConfirmation(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('respeta la desactivacion de WhatsApp', async () => {
    config.WHATSAPP_ENABLED = 'false';
    await service.sendTurnoConfirmation(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logs).toHaveLength(2);
  });
});
