import type { Expression } from '../context/AppContext'

interface Props {
  expression: Expression
  onClick: () => void
}

export default function PetCharacter({ expression, onClick }: Props) {
  return (
    <div className={`pet ${expression}`} onClick={onClick}>
      <div className="pet-body">
        <div className="pet-ear left" />
        <div className="pet-ear right" />
        <div className="pet-eyes">
          <div className="pet-eye" />
          <div className="pet-eye" />
        </div>
        <div className="pet-mouth" />
      </div>
      <div className="zzz">Z z z</div>
    </div>
  )
}
