"use client"

interface ScaleInputProps {
  label: string
  value: number
  onChange: (value: number) => void
}

export function ScaleInput({ label, value, onChange }: ScaleInputProps) {
  return (
    <div className="scale-row">
      <span>{label}</span>
      <div className="scale-options" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((option) => (
          <button
            className={option === value ? "scale-button is-active" : "scale-button"}
            key={option}
            type="button"
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
