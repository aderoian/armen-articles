import { useId, useState } from 'react';

const WIDTH = 8;

export function toUnsigned(bits: readonly boolean[]): number {
	return bits.reduce((value, bit) => value * 2 + (bit ? 1 : 0), 0);
}

export function toSigned(bits: readonly boolean[]): number {
	const unsigned = toUnsigned(bits);
	return bits[0] ? unsigned - 2 ** bits.length : unsigned;
}

function fromUnsigned(value: number): boolean[] {
	return Array.from({ length: WIDTH }, (_, index) => ((value >> (WIDTH - 1 - index)) & 1) === 1);
}

interface Props {
	/** Initial unsigned value, 0–255. */
	initial?: number;
}

/**
 * A small demonstration island: toggle the bits of a byte and see its unsigned,
 * two's-complement, and hexadecimal interpretations.
 */
export default function BitExplorer({ initial = 0b0010_1010 }: Props) {
	const [bits, setBits] = useState(() => fromUnsigned(initial));
	const labelId = useId();
	const unsigned = toUnsigned(bits);

	const toggle = (index: number) =>
		setBits((current) => current.map((bit, i) => (i === index ? !bit : bit)));

	return (
		<div
			className="not-prose border-border bg-surface my-8 rounded-lg border p-4 sm:p-5"
			role="group"
			aria-labelledby={labelId}
		>
			<p id={labelId} className="text-sm font-semibold">
				Bit explorer <span className="text-muted font-normal">(interactive demo)</span>
			</p>
			<p className="text-muted mt-1 text-sm">
				Each button is one bit, most significant first. Press a bit to flip it.
			</p>
			<div className="mt-4 grid grid-cols-8 gap-1.5 sm:gap-2">
				{bits.map((bit, index) => {
					const weight = WIDTH - 1 - index;
					return (
						<button
							key={weight}
							type="button"
							aria-pressed={bit}
							aria-label={`Bit ${weight} (value ${2 ** weight})`}
							onClick={() => toggle(index)}
							className={`flex min-h-11 flex-col items-center justify-center rounded-md border font-mono text-lg ${
								bit
									? 'border-accent bg-accent text-bg'
									: 'border-border-strong bg-bg text-text hover:border-accent'
							}`}
						>
							{bit ? 1 : 0}
							<span aria-hidden="true" className="text-[0.625rem] leading-none opacity-75">
								{weight}
							</span>
						</button>
					);
				})}
			</div>
			<dl className="mt-4 grid grid-cols-3 gap-2 text-center font-mono text-sm" aria-live="polite">
				<div className="bg-bg rounded-md p-2">
					<dt className="text-muted text-xs">unsigned</dt>
					<dd className="text-base">{unsigned}</dd>
				</div>
				<div className="bg-bg rounded-md p-2">
					<dt className="text-muted text-xs">signed</dt>
					<dd className="text-base">{toSigned(bits)}</dd>
				</div>
				<div className="bg-bg rounded-md p-2">
					<dt className="text-muted text-xs">hex</dt>
					<dd className="text-base">0x{unsigned.toString(16).toUpperCase().padStart(2, '0')}</dd>
				</div>
			</dl>
			<button
				type="button"
				onClick={() => setBits(fromUnsigned(0))}
				className="text-accent mt-3 min-h-10 text-sm underline underline-offset-4"
			>
				Reset to zero
			</button>
		</div>
	);
}
