import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, PenLine, Truck } from 'lucide-react';
import Navbar from '@/components/Navbar';

const steps = [
  { icon: BookOpen, title: 'Set Up Your Book', description: 'Tell us about your graduate and choose your writing style.' },
  { icon: PenLine, title: 'Write Your Chapters', description: 'Fill 52 chapters with verses, quotes, and your personal wisdom.' },
  { icon: Truck, title: 'We Print & Ship It', description: 'We turn your words into a beautiful hardcover book and deliver it.' },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-heading text-3xl md:text-5xl font-bold text-foreground leading-tight mb-6">
              Be confident you are sending your children out with everything they need to know.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Create a personalized book of wisdom for your graduating senior. 52 chapters. Your voice. Their future.
            </p>
            <Button size="lg" className="text-lg px-10 py-6 h-auto rounded-lg shadow-lg hover:shadow-xl transition-shadow" onClick={() => navigate('/register')}>
              Start Your Book
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-secondary/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-center text-foreground mb-14">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <div key={i} className="bg-card rounded-xl p-8 text-center shadow-sm border border-border hover:shadow-md transition-shadow">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="text-sm font-semibold text-primary mb-2">Step {i + 1}</div>
                <h3 className="font-heading text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          © {new Date().getFullYear()} 52 Things to Know. Made with love for families.
        </div>
      </footer>
    </div>
  );
};

export default Index;
