import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, HelpCircle } from 'lucide-react';

const faqSections = [
  {
    title: 'Getting Started',
    questions: [
      {
        q: 'What is 52 Things to Know?',
        a: 'It is a platform that helps you create a beautiful, printed book of wisdom for someone you love. Each book contains 52 chapters of life lessons, advice, and stories.',
      },
      {
        q: 'How do I create my first book?',
        a: 'Click "New Book" on your dashboard, enter details about the recipient, and your book will be generated with pre-filled chapter themes to guide your writing.',
      },
      {
        q: 'Is my work saved automatically?',
        a: 'Yes, your writing is saved automatically as you type. You can come back anytime and pick up right where you left off.',
      },
    ],
  },
  {
    title: 'Writing Your Book',
    questions: [
      {
        q: 'What is the word limit per chapter?',
        a: 'Chapters are designed around a word budget to ensure they fit beautifully on two pages. You can choose between 450 words (Classic) or 225 words (Photo) layouts.',
      },
      {
        q: 'Can I switch between Edit and Preview mode?',
        a: 'Yes. Use the toggle in the chapter editor to switch between writing (Edit) and seeing how your chapter will look in the printed book (Preview).',
      },
      {
        q: 'What happens when I mark a chapter complete?',
        a: 'Marking a chapter complete tells the system you are satisfied with it. You can still edit it later if you change your mind.',
      },
    ],
  },
  {
    title: 'Memories',
    questions: [
      {
        q: 'What are Memories?',
        a: 'Memories are short stories or reflections from friends and family that you can invite contributors to share. They add richness and community to your book.',
      },
      {
        q: 'How do I invite someone to contribute a memory?',
        a: 'From the Memory Manager, click "Invite Contributor" and enter their email. They will receive a link to write and submit a memory for your book.',
      },
      {
        q: 'Can I place memories inside chapters?',
        a: 'Yes. Approved memories can be dragged into any chapter as a highlighted story box that appears on Page 2 of that chapter.',
      },
    ],
  },
  {
    title: 'Photos',
    questions: [
      {
        q: 'How do I add photos to a chapter?',
        a: 'In the chapter editor, use the Photo Upload zone to add an image. Photos appear on Page 2 alongside your text and memories.',
      },
      {
        q: 'Are there photo requirements?',
        a: 'High-resolution images (at least 300 DPI) work best for print. The editor will guide you with a smart prompt to describe what makes a great photo for each chapter.',
      },
      {
        q: 'Can I replace or remove a photo?',
        a: 'Yes. You can upload a new photo at any time to replace the existing one, or remove it entirely if you prefer text only.',
      },
    ],
  },
  {
    title: 'The AI Companion',
    questions: [
      {
        q: 'What can the AI Companion help with?',
        a: 'The AI Companion can suggest ideas, help rephrase sentences, expand on a thought, or polish your writing while keeping your voice.',
      },
      {
        q: 'Is my content sent to the AI?',
        a: 'Only the text you choose to share in the chat panel is sent. The AI does not see your entire book unless you paste it into the conversation.',
      },
      {
        q: 'Can I undo an AI suggestion?',
        a: 'Yes. Each AI edit shows a preview first. You choose to apply it or try again. You can also use the Revert button to restore the last saved version.',
      },
    ],
  },
  {
    title: 'Ordering',
    questions: [
      {
        q: 'When will ordering be available?',
        a: 'Printed book ordering is coming soon. We are finalizing print partners to ensure the highest quality hardcover and paperback options.',
      },
      {
        q: 'What formats will be available?',
        a: 'We plan to offer both hardcover and paperback formats with premium paper and a lay-flat binding option for the best reading experience.',
      },
      {
        q: 'How much will a printed book cost?',
        a: 'Pricing will be announced when ordering opens. Early users may receive a discount as a thank-you for helping shape the platform.',
      },
    ],
  },
];

const HelpFaq = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Button variant="ghost" className="mb-6 -ml-2" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <HelpCircle className="h-8 w-8 text-primary" />
          <h1 className="font-heading text-3xl font-bold text-foreground">Help & FAQ</h1>
        </div>

        <div className="space-y-8">
          {faqSections.map((section) => (
            <div key={section.title}>
              <h2 className="font-heading text-xl font-semibold text-foreground mb-4">
                {section.title}
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {section.questions.map((item, idx) => (
                  <AccordionItem
                    key={idx}
                    value={`${section.title}-${idx}`}
                    className="border border-border rounded-lg px-4 mb-3 bg-card"
                  >
                    <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-4">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <Separator className="mt-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpFaq;
