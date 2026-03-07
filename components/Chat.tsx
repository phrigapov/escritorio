'use client'

import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import styles from './Chat.module.css'

interface Message {
  username: string
  text: string
  timestamp: number
}

interface ChatProps {
  username: string
}

export default function Chat({ username }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // Conectar ao servidor Socket.io
    socketRef.current = io('http://localhost:3001')

    socketRef.current.on('chat-message', (message: Message) => {
      setMessages(prev => [...prev, message])
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputText.trim() && socketRef.current) {
      const message: Message = {
        username,
        text: inputText.trim(),
        timestamp: Date.now()
      }
      socketRef.current.emit('chat-message', message)
      setInputText('')
    }
  }

  return (
    <div className={`${styles.chatContainer} ${!isOpen ? styles.closed : ''}`}>
      <div className={styles.chatHeader}>
        <h3>💬 Chat</h3>
        <button 
          className={styles.toggleButton}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>
      
      {isOpen && (
        <>
          <div className={styles.messagesContainer}>
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`${styles.message} ${msg.username === username ? styles.ownMessage : ''}`}
              >
                <strong>{msg.username}:</strong> {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSendMessage} className={styles.inputForm}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite uma mensagem..."
              className={styles.input}
              maxLength={200}
            />
            <button type="submit" className={styles.sendButton}>
              Enviar
            </button>
          </form>
        </>
      )}
    </div>
  )
}
