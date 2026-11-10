import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Card } from '@/components/ui';
import { Mail } from 'lucide-react';

export default function RecuperaçãoSenha() {
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-verde-discreto">GrowMoney</h1>
          <p className="text-text-secondary">Recuperar senha</p>
        </div>
        <form className="space-y-4">
          <Input
            type="email"
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Enviar instrucoes
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link to="/auth" className="text-verde-discreto hover:underline">
            Voltar ao login
          </Link>
        </div>
      </Card>
    </div>
  );
}
