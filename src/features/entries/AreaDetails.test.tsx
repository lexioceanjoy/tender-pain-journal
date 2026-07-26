import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AreaDetails, type AreaOverrides } from './AreaDetails';

function Example() {
  const [value, setValue] = useState<AreaOverrides>({});
  return (
    <AreaDetails
      selectedRegions={['back-low-left', 'foot-left']}
      defaultIntensity={6}
      defaultSensations={['aching']}
      value={value}
      onChange={setValue}
    />
  );
}

describe('area-specific details', () => {
  it('starts with overall values and allows a reversible exception', async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByText('Do any areas feel different?'));
    await user.click(screen.getByText('Left foot'));
    const slider = screen.getByRole('slider', { name: 'Intensity for Left foot' });
    expect(slider).toHaveValue('6');

    fireEvent.change(slider, { target: { value: '2' } });
    expect(slider).toHaveValue('2');
    await user.click(screen.getByRole('button', { name: 'Tingling for Left foot' }));
    expect(screen.getByText('2/10 · customized')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use overall settings' }));
    expect(screen.queryByText('2/10 · customized')).not.toBeInTheDocument();
    expect(screen.getAllByText('6/10 · overall')).toHaveLength(2);
  });
});
