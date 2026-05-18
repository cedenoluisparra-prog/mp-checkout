export interface CountryOption {
  label: string;
  idTypes: string[];
}

export const COUNTRY_CONFIG: Record<string, CountryOption> = {
  MX: { label: 'México',    idTypes: ['RFC', 'CURP', 'INE', 'PP'] },
  AR: { label: 'Argentina', idTypes: ['DNI', 'CI', 'LC', 'LE', 'PP'] },
  PE: { label: 'Perú',      idTypes: ['DNI', 'CE', 'PP'] },
  BR: { label: 'Brasil',    idTypes: ['CPF', 'CNPJ', 'RNE', 'PP'] },
  CO: { label: 'Colombia',  idTypes: ['CC', 'CE', 'NIT', 'PP'] },
  CL: { label: 'Chile',     idTypes: ['RUT', 'CI', 'PP'] },
  UY: { label: 'Uruguay',   idTypes: ['CI', 'RUT', 'PP'] },
};

export const DEFAULT_COUNTRY = 'MX';
