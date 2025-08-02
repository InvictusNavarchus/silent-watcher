import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

// Format timestamp to readable date/time
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  
  if (isToday(date)) {
    return format(date, 'HH:mm');
  } else if (isYesterday(date)) {
    return `Yesterday ${format(date, 'HH:mm')}`;
  } else {
    return format(date, 'MMM d, HH:mm');
  }
}

// Format timestamp to full date and time
export function formatFullTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return format(date, 'PPpp'); // e.g., "Apr 29, 2023 at 11:59 PM"
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return formatDistanceToNow(date, { addSuffix: true });
}

// Format file size in bytes to human readable
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format duration in seconds to readable format
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}

// Format phone number
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Add country code if not present
  if (!cleaned.startsWith('1') && cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  
  return phoneNumber;
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Format message content for preview
export function formatMessagePreview(content: string, maxLength: number = 50): string {
  // Remove line breaks and extra spaces
  const cleaned = content.replace(/\s+/g, ' ').trim();
  return truncateText(cleaned, maxLength);
}

// Format number with commas
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

// Format percentage
export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(1)}%`;
}

// Format uptime
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Format memory usage
export function formatMemory(bytes: number): string {
  return formatFileSize(bytes);
}

// Get message type display name
export function getMessageTypeDisplayName(type: string): string {
  const typeMap: Record<string, string> = {
    text: 'Text',
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    sticker: 'Sticker',
    location: 'Location',
    contact: 'Contact',
    poll: 'Poll',
    reaction: 'Reaction',
    system: 'System',
  };
  
  return typeMap[type] || type;
}

// Get connection state display
export function getConnectionStateDisplay(state: string): { text: string; color: string } {
  const stateMap: Record<string, { text: string; color: string }> = {
    open: { text: 'Connected', color: 'text-success-600' },
    connecting: { text: 'Connecting', color: 'text-warning-600' },
    close: { text: 'Disconnected', color: 'text-danger-600' },
  };
  
  return stateMap[state] || { text: state, color: 'text-gray-600' };
}

// Format search query highlight
export function highlightSearchTerm(text: string, searchTerm: string): string {
  if (!searchTerm.trim()) return text;
  
  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
}
