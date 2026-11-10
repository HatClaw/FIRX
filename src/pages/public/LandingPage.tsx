import { useEffect, useRef, useState } from 'react';
import 'bootstrap/dist/css/bootstrap-grid.min.css';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { useGSAP } from '@gsap/react';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileArchive,
  FileSignature,
  FileText,
  Headset,
  MapPinned,
  MessageCircle,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { InstallPwaButton } from '@/components/pwa/InstallPwaButton';

const heroPhrases = [
  'Cresça com controle.',
  'Organize cada oportunidade.',
  'Assine com mais agilidade.',
];

const features = [
  {
    icon: FileSignature,
    title: 'Contratos e assinaturas',
    desc: 'Crie documentos, envie para assinatura e acompanhe cada etapa em um só lugar.',
  },
  {
    icon: Wallet,
    title: 'Financeiro organizado',
    desc: 'Acompanhe parcelas, recebimentos e pendências com uma visão clara da operação.',
  },
  {
    icon: Calendar,
    title: 'Agenda comercial',
    desc: 'Mantenha compromissos, visitas e próximos contatos no ritmo da sua equipe.',
  },
  {
    icon: BarChart3,
    title: 'Indicadores e relatórios',
    desc: 'Veja o panorama da operação, as últimas alterações e os indicadores financeiros.',
  },
  {
    icon: Users,
    title: 'Equipe comercial',
    desc: 'Organize vendedores, acompanhe resultados e mantenha as conversas da equipe próximas.',
  },
  {
    icon: MapPinned,
    title: 'Visitas e rotas',
    desc: 'Envie visitas aos vendedores e acompanhe a posição durante o deslocamento autorizado.',
  },
  {
    icon: FileArchive,
    title: 'Arquivos e documentos',
    desc: 'Consulte arquivos vinculados aos contratos e à rotina da empresa em um só ambiente.',
  },
];

const modules = [
  { id: 'clientes', label: 'Clientes', icon: Users, eyebrow: 'Relacionamento', title: 'Do primeiro contato ao histórico completo.', description: 'Centralize cadastros, contatos, documentos e informações importantes para a equipe trabalhar com contexto.', points: ['Cadastro de pessoas e empresas', 'Busca e organização da base', 'Histórico ligado aos fluxos comerciais'] },
  { id: 'contratos', label: 'Contratos', icon: FileSignature, eyebrow: 'Documentos e assinaturas', title: 'Prepare, envie e acompanhe cada contrato.', description: 'Monte contratos com os dados da operação, acompanhe assinaturas e mantenha os documentos relacionados ao cliente.', points: ['Geração e edição de contratos', 'Assinatura digital acompanhada', 'Arquivos PDF e histórico'] },
  { id: 'financeiro', label: 'Financeiro', icon: CircleDollarSign, eyebrow: 'Recebimentos', title: 'Saiba o que entrou e o que ainda está previsto.', description: 'Organize parcelas, lançamentos, status de pagamento e comprovantes para ter uma leitura financeira mais clara.', points: ['Parcelas e recebimentos', 'Pendências e atrasos', 'Relatórios e exportação'] },
  { id: 'agenda', label: 'Agenda e visitas', icon: MapPinned, eyebrow: 'Equipe em campo', title: 'A agenda da equipe conectada ao cliente.', description: 'Organize compromissos e encaminhe visitas ao vendedor. Quando ele inicia o deslocamento, a posição autorizada sincroniza com o painel.', points: ['Solicitações direcionadas ao vendedor', 'Status atualizado em tempo real', 'Rota até o cliente pelo Google Maps'] },
  { id: 'equipe', label: 'Equipe', icon: Headset, eyebrow: 'Pessoas e comunicação', title: 'Cada pessoa com seu acesso e seu espaço.', description: 'Administre os usuários da equipe, acompanhe vendedores e mantenha a comunicação da operação organizada.', points: ['Perfis e permissões por função', 'Área exclusiva para vendedores', 'Chat e notificações em tempo real'] },
  { id: 'gestao', label: 'Gestão e segurança', icon: Shield, eyebrow: 'Visão administrativa', title: 'Mais transparência sobre o que acontece.', description: 'Consulte indicadores e atualizações recentes, administre módulos e acompanhe os registros de auditoria disponíveis.', points: ['Dashboard e gráficos do sistema', 'Atualizações com data e hora', 'Auditoria e controle de acesso'] },
];

const workflow = [
  { number: '01', icon: Building2, title: 'Configure a empresa', text: 'Crie seu espaço e reúna as informações principais da operação.' },
  { number: '02', icon: Users, title: 'Organize clientes e equipe', text: 'Cadastre a base comercial e convide as pessoas com os acessos adequados.' },
  { number: '03', icon: ClipboardCheck, title: 'Acompanhe a execução', text: 'Conecte contratos, assinaturas, agenda, visitas e atividades.' },
  { number: '04', icon: BarChart3, title: 'Consulte os resultados', text: 'Use os painéis e relatórios para acompanhar o andamento do negócio.' },
];

const faqs = [
  { q: 'O GrowMoney funciona no celular?', a: 'Sim. A interface se adapta a celular, tablet e computador. O sistema também oferece instalação PWA quando o navegador é compatível.' },
  { q: 'Como os vendedores entram no sistema?', a: 'O administrador cadastra o vendedor, envia o link de ativação e define o vínculo. Depois do login, o vendedor acessa uma área própria para visitas e rotas.' },
  { q: 'A localização do vendedor fica sempre ativa?', a: 'Não. O navegador solicita a permissão quando o vendedor inicia uma rota. A posição é atualizada durante o deslocamento com o app aberto.' },
  { q: 'Os clientes precisam criar uma conta para assinar?', a: 'O cliente acessa o documento pelo link individual enviado pela empresa e segue o fluxo de assinatura disponível.' },
];

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP);

function ProductPreview() {
  return (
    <div data-float className="relative mx-auto w-full max-w-[34rem] lg:ml-auto" aria-hidden="true">
      <div aria-hidden="true" className="absolute -inset-7 rounded-[2.5rem] bg-brand/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border-color/80 bg-bg-primary/95 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-border-color pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/12 text-brand">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-text-secondary">EXEMPLO ILUSTRATIVO</p>
              <p className="text-sm font-semibold text-text-primary">Sua operação</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Dados de exemplo
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 py-4 sm:gap-4">
          <div className="rounded-2xl bg-bg-secondary p-3.5 sm:p-4">
            <p className="text-xs text-text-secondary">A receber</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-text-primary sm:text-2xl">R$ 42.380</p>
            <p className="mt-1 text-[11px] font-medium text-brand-dark dark:text-brand-light">Visão financeira clara</p>
          </div>
          <div className="rounded-2xl bg-bg-secondary p-3.5 sm:p-4">
            <p className="text-xs text-text-secondary">Contratos ativos</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-text-primary sm:text-2xl">24</p>
            <p className="mt-1 text-[11px] font-medium text-text-secondary">Acompanhamento simples</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border-color p-3.5 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Fluxo da operação</p>
              <p className="text-xs text-text-secondary">Um panorama para decidir</p>
            </div>
            <span className="rounded-lg bg-bg-secondary px-2.5 py-1 text-[11px] font-medium text-text-secondary">Este mês</span>
          </div>
          <svg aria-hidden="true" viewBox="0 0 420 116" className="h-24 w-full overflow-visible">
            <defs>
              <linearGradient id="landing-chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.24" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 94H420M0 58H420M0 22H420" stroke="var(--border-color)" strokeDasharray="4 6" />
            <path d="M0 91 C42 85 55 73 84 78 S137 67 168 70 S212 42 252 51 S301 35 334 42 S382 15 420 17 L420 116 L0 116Z" fill="url(#landing-chart-fill)" />
            <path d="M0 91 C42 85 55 73 84 78 S137 67 168 70 S212 42 252 51 S301 35 334 42 S382 15 420 17" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="334" cy="42" r="5" fill="var(--brand)" stroke="var(--bg-primary)" strokeWidth="3" />
          </svg>
          <div className="flex justify-between pt-1 text-[10px] text-text-secondary"><span>Sem 1</span><span>Sem 2</span><span>Sem 3</span><span>Sem 4</span></div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-bg-secondary/80 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand"><Check className="h-4 w-4" /></span>
            <span className="truncate text-xs font-medium text-text-primary">Assinaturas acompanhadas</span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-bg-secondary/80 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand"><ShieldCheck className="h-4 w-4" /></span>
            <span className="truncate text-xs font-medium text-text-primary">Dados em um só ambiente</span>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2.5 rounded-2xl border border-border-color bg-bg-primary px-4 py-3 shadow-xl sm:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/12 text-brand"><Sparkles className="h-4 w-4" /></span>
        <span><span className="block text-xs font-semibold text-text-primary">Mais clareza</span><span className="block text-[11px] text-text-secondary">em cada etapa do negócio</span></span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [typedPhrase, setTypedPhrase] = useState('');
  const [activeModule, setActiveModule] = useState(modules[0]);

  const scrollToSection = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      return;
    }
    gsap.to(window, { duration: 0.9, ease: 'power3.inOut', scrollTo: { y: target, offsetY: 84 } });
  };

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.landing-hero-copy > *', { y: 24, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out', delay: 0.12 });
      gsap.from('[data-hero-visual]', { y: 36, opacity: 0, scale: 0.97, duration: 1, ease: 'power3.out', delay: 0.28 });
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
        gsap.from(element, {
          y: 34,
          opacity: 0,
          duration: 0.72,
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'top 88%', once: true },
        });
      });
      gsap.to('[data-parallax]', {
        yPercent: -18,
        ease: 'none',
        scrollTrigger: { trigger: '.gradient-hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
      gsap.to('[data-float]', { y: -9, duration: 2.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    });
    return () => media.revert();
  }, { scope: pageRef });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTypedPhrase(heroPhrases[0]);
      return;
    }

    let phraseIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const phrase = heroPhrases[phraseIndex];
      if (!phrase) return;
      characterIndex += deleting ? -1 : 1;
      setTypedPhrase(phrase.slice(0, characterIndex));

      if (!deleting && characterIndex >= phrase.length) {
        deleting = true;
        timer = window.setTimeout(tick, 1700);
        return;
      }
      if (deleting && characterIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % heroPhrases.length;
        timer = window.setTimeout(tick, 380);
        return;
      }
      timer = window.setTimeout(tick, deleting ? 32 : 72);
    };
    timer = window.setTimeout(tick, 220);
    return () => window.clearTimeout(timer);
  }, []);

  const phraseParts = typedPhrase.split(/(\s+)/);
  let wordIndex = -1;

  return (
    <div ref={pageRef} className="min-h-screen overflow-x-clip bg-transparent text-text-primary">
      <header className="sticky top-0 z-50 border-b border-border-color/70 bg-bg-primary/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center" aria-label={`${BRAND.name} — início`}>
            <BrandLogo linkTo={false} heightClass="h-11 sm:h-14" className="max-w-[min(44vw,210px)] object-left sm:max-w-[250px]" />
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-6 lg:flex">
            <a href="#recursos" onClick={scrollToSection('recursos')} className="text-sm font-medium text-text-secondary hover:text-brand">Recursos</a>
            <a href="#como-funciona" onClick={scrollToSection('como-funciona')} className="text-sm font-medium text-text-secondary hover:text-brand">Como funciona</a>
            <a href="#seguranca" onClick={scrollToSection('seguranca')} className="text-sm font-medium text-text-secondary hover:text-brand">Segurança</a>
          </nav>
          <nav aria-label="Acesso" className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link to="/auth"><Button variant="ghost" size="sm" className="px-3 sm:px-4">Entrar</Button></Link>
            <Link to="/cadastro"><Button size="sm" className="gap-1.5 px-3 sm:px-4">Começar grátis <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Button></Link>
          </nav>
        </div>
        <nav aria-label="Atalhos da landing page" className="border-t border-border-color/50 px-4 py-2 lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <a href="#recursos" onClick={scrollToSection('recursos')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Recursos</a>
            <a href="#modulos" onClick={scrollToSection('modulos')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Módulos</a>
            <a href="#como-funciona" onClick={scrollToSection('como-funciona')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Como funciona</a>
            <a href="#seguranca" onClick={scrollToSection('seguranca')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Segurança</a>
            <a href="#duvidas" onClick={scrollToSection('duvidas')} className="py-1 text-xs font-medium text-text-secondary hover:text-brand">Dúvidas</a>
          </div>
        </nav>
      </header>

      <main>
        <section id="inicio" className="gradient-hero relative isolate overflow-hidden">
          <div data-parallax aria-hidden="true" className="pointer-events-none absolute -inset-y-16 -right-16 -z-10 w-[70%] bg-[radial-gradient(ellipse_42%_50%_at_85%_42%,rgba(255,106,0,0.17),transparent_75%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute right-[8%] top-[14%] -z-10 h-64 w-64 rounded-full border border-brand/10" />
          <div aria-hidden="true" className="pointer-events-none absolute right-[12%] top-[18%] -z-10 h-48 w-48 rounded-full border border-brand/10" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:gap-10 lg:px-8 lg:py-24">
            <div className="landing-hero-copy mx-auto w-full max-w-2xl text-center lg:mx-0 lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-brand-dark dark:text-brand-light">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> GESTÃO COMERCIAL E FINANCEIRA
              </div>
              <h1 className="font-display text-[clamp(2.65rem,7.6vw,5.6rem)] font-light leading-[0.98] tracking-[-0.065em] text-text-primary">
                Mais clareza.
                <br />
                <span className="sr-only">{typedPhrase || heroPhrases[0]}</span>
                <span aria-hidden="true" className="text-gradient">
                  {phraseParts.map((part, index) => {
                    if (/^\s+$/.test(part)) return <span key={index}>{part}</span>;
                    wordIndex += 1;
                    return <span key={index} className={wordIndex % 2 === 1 ? 'font-bold' : 'font-light'}>{part}</span>;
                  })}
                  <span className="ml-0.5 inline-block h-[0.76em] w-[2px] translate-y-1 bg-brand align-baseline motion-safe:animate-pulse" />
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-text-secondary sm:text-lg sm:leading-8 lg:mx-0">
                Contratos, agenda e financeiro conectados para você cuidar do crescimento com mais organização e tranquilidade.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Link to="/cadastro" className="w-full sm:w-auto"><Button size="lg" className="w-full gap-2 sm:w-auto">Criar conta grátis <ArrowRight aria-hidden="true" className="h-4 w-4" /></Button></Link>
                <Link to="/auth" className="w-full sm:w-auto"><Button size="lg" variant="outline" className="w-full sm:w-auto">Já tenho conta</Button></Link>
              </div>
              <div className="mt-4 flex justify-center lg:justify-start"><InstallPwaButton className="w-full sm:w-auto" /></div>
              <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2.5 text-xs font-medium text-text-secondary sm:text-sm lg:justify-start">
                {['Contratos e assinaturas', 'Agenda comercial', 'Financeiro integrado'].map((label) => (
                  <span key={label} className="inline-flex items-center gap-1.5"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-brand" />{label}</span>
                ))}
              </div>
            </div>
            <div data-hero-visual><ProductPreview /></div>
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Tudo conectado</p>
            <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] text-text-primary sm:text-4xl">Uma rotina mais simples, <span className="font-bold">do contrato ao recebimento.</span></h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary sm:text-base sm:leading-7">Menos informação espalhada. Mais visibilidade sobre o que acontece no seu negócio.</p>
          </div>
          <div className="row mx-0 g-3 g-lg-4">
            {features.map((feature, index) => (
              <article key={feature.title} data-reveal className="col-12 col-sm-6 col-lg-3"><div className="card-premium group relative h-full overflow-hidden p-5 sm:p-6">
                <div aria-hidden="true" className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand/5 blur-2xl transition-colors group-hover:bg-brand/15" />
                <span className="relative mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/12 text-brand transition-transform duration-200 group-hover:scale-105"><feature.icon aria-hidden="true" className="h-5 w-5" /></span>
                <p className="mb-2 text-[11px] font-bold tracking-[0.16em] text-brand">0{index + 1}</p>
                <h3 className="relative text-base font-semibold tracking-tight text-text-primary">{feature.title}</h3>
                <p className="relative mt-2 text-sm leading-6 text-text-secondary">{feature.desc}</p>
              </div></article>
            ))}
          </div>
        </section>

        <section id="modulos" className="border-y border-border-color/70 bg-bg-primary/55 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div data-reveal className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Uma operação conectada</p>
              <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] sm:text-4xl">Explore os módulos do <span className="font-bold">GrowMoney.</span></h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">Abra uma seção para conhecer os fluxos que ajudam sua empresa a sair de informações espalhadas para uma rotina acompanhável.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-8">
              <div data-reveal className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 lg:content-start">
                {modules.map((module) => <button key={module.id} type="button" aria-pressed={activeModule.id === module.id} onClick={() => setActiveModule(module)} className={`flex min-h-16 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-all sm:gap-3 sm:px-4 ${activeModule.id === module.id ? 'border-brand bg-brand/10 text-brand shadow-sm' : 'border-border-color bg-bg-primary text-text-secondary hover:border-brand/40 hover:bg-brand/5'}`}><module.icon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden="true"/><span>{module.label}</span></button>)}
              </div>
              <article key={activeModule.id} data-reveal className="relative min-h-[340px] overflow-hidden rounded-[1.75rem] border border-border-color bg-bg-primary p-5 shadow-lg sm:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
                <div className="relative">
                  <div className="mb-6 flex items-center justify-between gap-4"><span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand"><activeModule.icon className="h-3.5 w-3.5"/>{activeModule.eyebrow}</span><span className="hidden text-xs text-text-secondary sm:block">{String(modules.findIndex((module) => module.id === activeModule.id) + 1).padStart(2, '0')} / 06</span></div>
                  <h3 className="max-w-xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{activeModule.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">{activeModule.description}</p>
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">{activeModule.points.map((point) => <li key={point} className="flex items-start gap-2.5 text-sm text-text-secondary"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand"/>{point}</li>)}</ul>
                  <Link to="/cadastro" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:gap-3">Comece sua conta <ArrowRight className="h-4 w-4"/></Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div data-reveal className="mx-auto mb-10 max-w-2xl text-center"><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Comece com clareza</p><h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] sm:text-4xl">Uma rotina simples, <span className="font-bold">etapa por etapa.</span></h2></div>
          <div className="row mx-0 g-3 g-lg-4">
            {workflow.map((step) => <article key={step.number} data-reveal className="col-12 col-sm-6 col-lg-3"><div className="group h-full rounded-2xl border border-border-color bg-bg-primary p-5 transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg sm:p-6"><div className="mb-5 flex items-center justify-between"><span className="text-xs font-bold tracking-[0.18em] text-brand">{step.number}</span><step.icon className="h-5 w-5 text-brand" aria-hidden="true"/></div><h3 className="text-base font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">{step.text}</p></div></article>)}
          </div>
        </section>

        <section id="seguranca" className="scroll-mt-24 bg-[#101827] py-16 text-white sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8">
            <div data-reveal><span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand"><ShieldCheck className="h-6 w-6"/></span><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-light">Acesso organizado</p><h2 className="max-w-xl text-3xl font-light leading-tight tracking-[-0.045em] sm:text-4xl">Cada pessoa vê o que precisa para trabalhar.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">Funções e permissões ajudam a separar a operação da administração. Vendedores têm uma área própria; administradores acompanham os módulos e os registros disponíveis.</p><Link to="/privacidade" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-white">Conheça a política de privacidade <ArrowUpRight className="h-4 w-4"/></Link></div>
            <div className="row mx-0 g-3">
              {[{icon:BadgeCheck,title:'Perfis por função',text:'Acesso alinhado ao papel de cada pessoa.'},{icon:MapPinned,title:'GPS sob permissão',text:'Localização vinculada à rota iniciada pelo vendedor.'},{icon:MessageCircle,title:'Atualizações em tempo real',text:'Visitas e conversas sincronizadas com o sistema.'},{icon:FileArchive,title:'Histórico organizado',text:'Documentos e registros no contexto da operação.'}].map((item) => <div key={item.title} data-reveal className="col-12 col-sm-6"><div className="flex h-full gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"><item.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand"/><div><h3 className="text-sm font-semibold">{item.title}</h3><p className="mt-1 text-xs leading-5 text-white/60">{item.text}</p></div></div></div>)}
            </div>
          </div>
        </section>

        <section id="duvidas" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <div data-reveal className="mb-8 text-center"><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-brand">Perguntas frequentes</p><h2 className="font-display text-3xl font-light tracking-[-0.045em] sm:text-4xl">Antes de começar.</h2></div>
          <div className="space-y-2">{faqs.map((item) => <details key={item.q} data-reveal className="group rounded-2xl border border-border-color bg-bg-primary px-4 open:border-brand/40 open:shadow-sm sm:px-5"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">{item.q}<ChevronDown className="h-4 w-4 shrink-0 text-brand transition-transform group-open:rotate-180"/></summary><p className="max-w-3xl pb-4 pr-8 text-sm leading-6 text-text-secondary">{item.a}</p></details>)}</div>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-brand/20 bg-bg-primary px-6 py-12 text-center shadow-lg sm:px-10 sm:py-16">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_100%_at_50%_100%,rgba(255,106,0,0.16),transparent_80%)]" />
            <div className="relative mx-auto max-w-2xl">
              <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand"><FileText aria-hidden="true" className="h-5 w-5" /></span>
              <h2 className="font-display text-3xl font-light leading-tight tracking-[-0.045em] text-text-primary sm:text-4xl">Pronto para ter <span className="font-bold">mais clareza?</span></h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base sm:leading-7">{BRAND.tagline}</p>
              <Link to="/cadastro" className="mt-7 inline-flex"><Button size="lg" className="gap-2">Começar agora <ArrowRight aria-hidden="true" className="h-4 w-4" /></Button></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-color/80 bg-bg-primary/50 py-7">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-text-secondary sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo linkTo={false} heightClass="h-9" className="max-w-[170px] object-left opacity-90" />
            <span className="text-xs sm:text-sm">© 2027 {BRAND.name}</span>
          </div>
          <nav aria-label="Informações legais" className="flex items-center gap-5 text-xs sm:text-sm">
            <Link to="/termos" className="transition-colors hover:text-text-primary">Termos</Link>
            <Link to="/privacidade" className="transition-colors hover:text-text-primary">Privacidade</Link>
          </nav>
        </div>
        <div className="mx-auto mt-5 flex w-full max-w-7xl flex-col items-center justify-center gap-1 border-t border-border-color/60 px-4 pt-4 text-center text-xs text-text-secondary sm:px-6 lg:px-8">
          <p className="w-full text-center">© 2027 {BRAND.name}. Todos os direitos reservados.</p>
          <p className="w-full text-center">Desenvolvido por <a href="https://agenciaafrica.com.br" target="_blank" rel="noopener noreferrer" className="font-semibold text-text-primary transition-colors hover:text-brand">Agência AFRICA</a></p>
        </div>
      </footer>
    </div>
  );
}
