import { useState } from 'react';
import { Search, Filter, Download, RefreshCw } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatTimestamp, formatMessagePreview } from '@/utils/format';
import type { Message, MessageQuery, PaginatedResponse, FilterState } from '@/types';

export function MessagesPage() {
  const [filters, setFilters] = useState<FilterState>({
    days: 7,
    messageState: 'all',
    search: '',
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  
  const debouncedSearch = useDebounce(filters.search, 300);
  
  const query: MessageQuery = {
    days: filters.days,
    state: filters.messageState,
    search: debouncedSearch,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    ...(filters.chatId && { chatId: filters.chatId }),
    ...(filters.messageType && { type: filters.messageType }),
  };

  const { 
    data: messagesResponse, 
    loading, 
    error, 
    refetch 
  } = useApi<Message[]>('/messages?' + new URLSearchParams(
    Object.entries(query).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {} as Record<string, string>)
  ).toString());

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export messages with filters:', filters);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-danger-600 mb-4">Failed to load messages</p>
          <button onClick={handleRefresh} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Messages
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and search through all WhatsApp messages
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="btn btn-primary"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                className="input pl-10"
                value={filters.search}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
              />
            </div>

            {/* Days Filter */}
            <select
              className="input"
              value={filters.days}
              onChange={(e) => handleFilterChange({ days: parseInt(e.target.value) })}
            >
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>

            {/* Message State Filter */}
            <select
              className="input"
              value={filters.messageState}
              onChange={(e) => handleFilterChange({ messageState: e.target.value as any })}
            >
              <option value="all">All messages</option>
              <option value="edited">Edited only</option>
              <option value="deleted">Deleted only</option>
            </select>

            {/* Message Type Filter */}
            <select
              className="input"
              value={filters.messageType || ''}
              onChange={(e) => handleFilterChange({ 
                messageType: e.target.value || undefined 
              })}
            >
              <option value="">All types</option>
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="document">Document</option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Messages
            </h3>
            {messagesResponse && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {messagesResponse.pagination?.total || 0} total messages
              </span>
            )}
          </div>
        </div>
        
        <div className="card-body p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : messagesResponse?.data && messagesResponse.data.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {messagesResponse.data.map((message) => (
                <div
                  key={message.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {message.senderId.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    
                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {message.senderId}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimestamp(message.timestamp)}
                          </span>
                          {message.isFromMe && (
                            <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded dark:bg-primary-900 dark:text-primary-200">
                              You
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {message.messageType}
                          </span>
                          {message.isForwarded && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded dark:bg-gray-800 dark:text-gray-400">
                              Forwarded
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {formatMessagePreview(message.content, 100)}
                      </p>
                      
                      {message.chatId && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Chat: {message.chatId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No messages found matching your filters
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {messagesResponse?.pagination && messagesResponse.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Showing page {messagesResponse.pagination.page} of {messagesResponse.pagination.totalPages}
          </p>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(messagesResponse.pagination.totalPages, prev + 1))}
              disabled={currentPage === messagesResponse.pagination.totalPages}
              className="btn btn-secondary"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
