import { Shield, Clock, Smartphone, Calendar } from "lucide-react";

const ExclusiveBenefits = () => {
  const benefits = [
    {
      icon: Shield,
      color: "bg-blue-100 dark:bg-blue-950/30",
      iconColor: "text-primary",
      title: "जबाबदारी समर्थन",
      description: "नियमित फॉलो-अप आणि मार्गदर्शनाद्वारे तुमची आरोग्य उद्दिष्टे साध्य करा.",
    },
    {
      icon: Clock,
      color: "bg-yellow-100 dark:bg-yellow-950/30",
      iconColor: "text-yellow-600 dark:text-yellow-500",
      title: "लवचिक वेळापत्रक",
      description: "तुमच्या सोयीनुसार विविध वेळेच्या स्लॉटमधून निवडा. दररोज ७ बॅच उपलब्ध.",
    },
    {
      icon: Smartphone,
      color: "bg-green-100 dark:bg-green-950/30",
      iconColor: "text-green-600 dark:text-green-500",
      title: "सोपी उपलब्धता",
      description: "कोणत्याही ठिकाणाहून, कोणत्याही वेळी सहजपणे सेशनमध्ये सामील व्हा.",
    },
    {
      icon: Calendar,
      color: "bg-purple-100 dark:bg-purple-950/30",
      iconColor: "text-purple-600 dark:text-purple-500",
      title: "सवयी ट्रॅकिंग आणि रिमाइंडर",
      description: "निरोगी सवयी निर्माण आणि टिकवण्यासाठी नियमित स्मरणपत्रे मिळवा.",
    },
  ];

  return (
    <section className="bg-background px-4 py-8 pb-16">
      <div className="max-w-md mx-auto">
        <p className="text-accent text-center text-sm font-semibold mb-2">
          काय समाविष्ट आहे?
        </p>
        <h2 className="text-3xl font-bold text-center text-foreground mb-8">
          तुमचे विशेष फायदे
        </h2>

        <div className="space-y-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div className={`${benefit.color} rounded-lg p-3 shrink-0`}>
                  <benefit.icon className={`h-6 w-6 ${benefit.iconColor}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExclusiveBenefits;
