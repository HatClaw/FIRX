import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Card } from '@/components/ui';
import { User, Building, Mail, Lock, FileText } from 'lucide-react';

export default function Cadastre() {
  const [empresa, setEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-verde-discreto">GrowMoney</h1>
          <p className="text-text-secondary">Crie sua conta empresarial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome da Empresa"
            placeholder="Nome da sua empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            leftIcon={<Building className="w-4 h-4" />}
            required
          />
          <Input
            label="CNPJ"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            leftIcon={<FileText className="w-4 h-4" />}
          />
          <Input
            label="Nome do Administrador"
            placeholder="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />
          <Input
            type="email"
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            type="password"
            label="Senha"
            placeholder="Crie uma senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />
          <Input
            type="password"
            label="Confirmar Senha"
            placeholder="Confirme a senha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Criar Conta
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-text-secondary">
          Ja tem conta?{' '}
          <Link to="/auth" className="text-verde-discreto hover:underline">
            Entre aqui
          </Link>
        </div>
      </Card>
    </div>
  );
}
