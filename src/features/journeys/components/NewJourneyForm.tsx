import { useState } from 'react';

import { JourneyForm, type JourneyFormValues } from '@/features/journeys/components/JourneyForm';
import { useJourneys } from '@/features/journeys/JourneyProvider';

const today = new Date().toISOString().slice(0, 10);

type NewJourneyFormProps = {
  embedded?: boolean;
  onCancel?: () => void;
  onCreated: (journeyId: string) => void;
};

export function NewJourneyForm({ embedded = false, onCancel, onCreated }: NewJourneyFormProps) {
  const { create } = useJourneys();
  const [formKey, setFormKey] = useState(0);

  async function submit(values: JourneyFormValues) {
    const journey = await create(values);
    setFormKey((current) => current + 1);
    onCreated(journey.id);
  }

  return (
    <JourneyForm
      key={formKey}
      embedded={embedded}
      eyebrow="NEW ALBUM"
      heading={embedded ? 'Start a new journey.' : 'Where will your memories live?'}
      submitLabel="Create Journey"
      initialValues={{
        title: '',
        destination: '',
        country: '',
        start_date: today,
        end_date: today,
        description: null,
        latitude: null,
        longitude: null,
      }}
      onSubmit={submit}
      onCancel={onCancel}
    />
  );
}
