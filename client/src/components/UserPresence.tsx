import { motion, AnimatePresence } from 'framer-motion';
import type { RoomUser } from '../types';

interface Props {
  users: RoomUser[];
}

export default function UserPresence({ users }: Props) {
  const maxVisible = 5;
  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className="flex items-center gap-1">
      <AnimatePresence>
        {visible.map((user) => (
          <motion.div
            key={user.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="relative group"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-editor-sidebar"
              style={{ backgroundColor: user.color }}
              title={user.username}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            {/* Tooltip */}
            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
              {user.username}
            </div>
            {/* Online indicator */}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-editor-sidebar bg-green-400"
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {overflow > 0 && (
        <div className="w-7 h-7 rounded-full bg-editor-border flex items-center justify-center text-gray-400 text-xs font-medium">
          +{overflow}
        </div>
      )}
    </div>
  );
}
