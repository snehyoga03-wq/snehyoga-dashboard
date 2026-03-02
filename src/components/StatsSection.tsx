const StatsSection = () => {
  return (
    <section className="bg-muted px-4 py-8">
      <div className="max-w-md mx-auto">
        <h3 className="text-center text-lg font-semibold text-foreground mb-6">
          आमचे समुदाय सदस्य
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary rounded-xl p-6 text-center">
            <p className="text-4xl font-bold text-foreground mb-2">१२ +</p>
            <p className="text-sm font-medium text-foreground">वर्षांचा अनुभव</p>
          </div>
          <div className="bg-secondary rounded-xl p-6 text-center">
            <p className="text-4xl font-bold text-foreground mb-2">4.9/5</p>
            <p className="text-sm font-medium text-foreground">Google रेटिंग</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
