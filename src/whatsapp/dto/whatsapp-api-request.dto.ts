export interface WhatsappTemplateTextParameter {
  type: 'text';
  text: string;
  parameter_name?: string;
}

export interface WhatsappTemplateImageParameter {
  type: 'image';
  image: {
    link: string;
  };
}

export interface WhatsappTemplateBodyComponent {
  type: 'body';
  parameters: WhatsappTemplateTextParameter[];
}

export interface WhatsappTemplateHeaderComponent {
  type: 'header';
  parameters: WhatsappTemplateImageParameter[];
}

export type WhatsappTemplateComponent =
  | WhatsappTemplateBodyComponent
  | WhatsappTemplateHeaderComponent;

export interface WhatsappApiRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components: WhatsappTemplateComponent[];
  };
}
