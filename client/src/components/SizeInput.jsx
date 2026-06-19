const DEFAULT_SIZES = ['4', '6', '8', '10', '12', '14', '16', '18', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

/**
 * Size field: pick from suggestions or type any custom size.
 */
export default function SizeInput({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Select or type size',
  suggestions = DEFAULT_SIZES,
  className = 'input-field',
  id = 'size-input',
  hideHint = false,
  hint = 'Choose from the list or type your own size',
}) {
  const listId = `${id}-list`;

  return (
    <>
      <input
        id={id}
        type="text"
        list={listId}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {!hideHint && hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </>
  );
}

export { DEFAULT_SIZES };
