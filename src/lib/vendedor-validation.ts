export function somenteDigitos(value: string) {
  return value.replace(/\D/g, '');
}

export function formatarCpf(value: string) {
  const digits = somenteDigitos(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function cpfValido(value: string) {
  const cpf = somenteDigitos(value);
  if (cpf.length !== 11 || /^([0-9])\1{10}$/.test(cpf)) return false;
  const calcular = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((total, digito, index) => total + Number(digito) * (pesoInicial - index), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcular(cpf.slice(0, 9), 10) === Number(cpf[9])
    && calcular(cpf.slice(0, 10), 11) === Number(cpf[10]);
}
