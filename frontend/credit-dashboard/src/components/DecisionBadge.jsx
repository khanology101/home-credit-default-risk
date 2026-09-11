export default function DecisionBadge({ decision }) {
  const styles = {
    'AUTO-APPROVE' : 'bg-green-100  text-green-800  border-green-300',
    'MANUAL REVIEW': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'SENIOR REVIEW': 'bg-orange-100 text-orange-800 border-orange-300',
    'DECLINED'     : 'bg-red-100    text-red-800    border-red-300',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${styles[decision] || 'bg-gray-100 text-gray-800'}`}>
      {decision}
    </span>
  );
}