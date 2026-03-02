import { Sun, Moon } from "lucide-react";

const ClassTimings = () => {
  return (
    <section className="bg-card px-4 py-8">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-center text-foreground mb-2">
          बॅच वेळापत्रक
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-6">
          दररोज ६ बॅच (प्रत्येक बॅच ५५ मिनिटे) | रविवारी सुट्टी
        </p>

        <div className="grid grid-cols-2 gap-4">
          {/* Morning Slot */}
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sun className="h-5 w-5 text-accent" />
              <h3 className="font-semibold text-foreground">सकाळी (AM)</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">🌞 5:00 AM</p>
              <p className="text-sm font-medium text-foreground">🌞 6:00 AM</p>
              <p className="text-sm font-medium text-foreground">🌞 7:30 AM</p>
            </div>
          </div>

          {/* Evening Slot */}
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Moon className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">संध्याकाळी (PM)</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">🌙 5:00 PM</p>
              <p className="text-sm font-medium text-foreground">🌙 6:00 PM</p>
              <p className="text-sm font-medium text-foreground">🌙 9:00 PM</p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          तुमच्या सोयीनुसार कोणताही बॅच निवडा
        </p>
      </div>
    </section>
  );
};

export default ClassTimings;