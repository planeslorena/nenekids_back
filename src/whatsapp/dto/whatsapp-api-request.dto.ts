export interface WhatsappTemplateTextParameter {
  type: 'text';
  text: string;
  parameter_name?: string;
}

export interface WhatsappApiRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components: Array<{
      type: 'body';
      parameters: WhatsappTemplateTextParameter[];
    }>;
  };
}
